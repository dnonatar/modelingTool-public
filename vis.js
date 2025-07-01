// colors
const baseChart_col = "#69b3a2";
const predictChart_col = "#0096FF";
//const bar_col = "#ccc";
const bar_col = "#69b3a2";
const brush_col = "orange";
const residual_col = "red";

let highlightedIndices = new Set();
let currentHoveredBar = null; // Track the currently hovered bar

const brushedPointsByPlot = {};


function renderDistributionPlot(container, featureKey, featureName, location = 'visArea', dataSubset = dataset) {

    container = d3.select(container)

    let size;
    let margin;
    if (location == 'visArea') {
        size = 200;
        margin = { top: 10, right: 10, bottom: 40, left: 40 };
    } else if (location == 'table') {
        size = 50;
        margin = { top: 10/4, right: 10/4, bottom: 10/4, left: 10/4 };
    }
    


    const width = size - margin.left - margin.right;
    const height = size - margin.top - margin.bottom;

    const isPrediction = featureKey.startsWith('pred'); // Check for prediction features
    const isResidual = featureKey.startsWith('residual');
    const pointColor = isPrediction ? predictChart_col : (isResidual ? residual_col : baseChart_col);

    // Set the plot type as distribution
    container.attr("data-plot-type", "distribution")
    .attr("data-feature-x", featureKey)
            //.attr("id", chartId);

    // Preprocess the dataset for the specified feature
    const mappedData = dataSubset.map((d, i) => ({
        value: +d[featureKey], // Convert feature to numeric
        index: i               // Attach the original index
    }));

    const x = d3.scaleLinear()
        .domain(d3.extent(mappedData, d => d.value)) // Use the extent of the feature values
        .nice()
        .range([margin.left, size - margin.right]);        

    const bins = d3.histogram()
        .domain(x.domain())
        .thresholds(10)
        .value(d => d.value)(mappedData);

    bins.forEach((bin, i) => {
        bin.indices = bin.map(d => d.index); // Add indices for linking
    });

    const y = d3.scaleLinear()
        .domain([0, d3.max(bins, d => d.length)])
        .nice()
        .range([size - margin.bottom, margin.top]);

    const svg = container.append("svg")
        .attr("width", size)
        .attr("height", size)
        .attr("class", "distribution-plot")
        .attr("data-feature-x", featureKey);

    if (featureKey.startsWith('residual')) {
        svg.append("line")
            .attr("x1", x(0))
            .attr("x2", x(0))
            .attr("y1", margin.top)
            .attr("y2", size - margin.bottom)
            .attr("stroke", "black")
            .attr("stroke-width", 1)
            .attr("stroke-dasharray", "4 2"); // Dashed line
    }

    // Draw histogram bars
    svg.append("g")
        .selectAll("rect")
        .data(bins)
        .enter().append("rect")
        .attr("x", d => x(d.x0) + 1)
        .attr("y", d => y(d.length))
        .attr("width", d => x(d.x1) - x(d.x0) - 1)
        .attr("height", d => y(0) - y(d.length))
        .attr("fill", pointColor)
        .attr("class", "histogram-bar")
        .attr("data-bin-indices", d => JSON.stringify(d.indices)); // Attach indices for linking
        
    if (location == 'visArea') {
        // X-axis
        svg.append("g")
            .attr("transform", `translate(0,${size - margin.bottom})`)
            .call(d3.axisBottom(x).tickSize(3).ticks(5));

        // Y-axis
        svg.append("g")
            .attr("transform", `translate(${margin.left},0)`)
            .call(d3.axisLeft(y).tickSize(3).ticks(5));

        // X-axis label
        svg.append("text")
            .attr("text-anchor", "middle")
            .attr("x", width / 2 + margin.left)
            .attr("y", size - 5)
            .text(featureName);

        // Y-axis label
        svg.append("text")
            .attr("text-anchor", "middle")
            .attr("transform", "rotate(-90)")
            .attr("x", -height / 2 - margin.top)
            .attr("y", 15)
            .text("Frequency");

        // Add remove button
        addRemoveButton(container);

    } if (location == 'table') {
        svg.append("g")
            .attr("transform", `translate(0,${size - margin.bottom})`)
            .call(d3.axisBottom(x).tickSize(1).ticks(2));
    }
    
}


function renderBarChart(container, featureKey, featureName) {
    container = d3.select(container);
    const size = 200;
    const margin = { top: 10, right: 10, bottom: 40, left: 40 };
    const width = size - margin.left - margin.right;
    const height = size - margin.top - margin.bottom;

    container.attr("data-plot-type", "barchart");
    
    const data = d3.rollups(
        dataset,
        v => ({
            count: v.length,
            indices: v.map((_, idx) => dataset.indexOf(v[idx])) // Use the original dataset index
        }),
        d => d[featureKey]
    ).map(([key, value]) => ({ category: key, ...value }));

    const x = d3.scaleBand()
        .domain(data.map(d => d.category))
        .range([margin.left, size - margin.right])
        .padding(0.1);

    const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.count)])
        //.nice()
        .range([size - margin.bottom, margin.top]);

    const svg = container.append("svg")
        .attr("class", "bar-chart")
        .attr("data-feature-x", featureKey)
        .attr("width", size)
        .attr("height", size);

    let hoverIndices = new Set();
    
    // Draw background bars for the full dataset
    svg.selectAll(".background-bar")
        .data(data)
        .enter()
        .append("rect")
        .attr("class", "background-bar")
        .attr("x", d => x(d.category))
        .attr("y", d => y(d.count))
        .attr("width", x.bandwidth())
        .attr("height", d => y(0) - y(d.count))
        .attr("fill", "#c7c7c7") // Gray color for background bars
        .attr("data-indices", d => JSON.stringify(d.indices)) // Store indices for hover interaction
        .on("mouseover", function (event, d) {
            // Track the currently hovered bar
            currentHoveredBar = this;
            
            // Change bar color to orange
            d3.select(this).attr("fill", brush_col);

            
            // Indices of the hovered bar
            const hoveredIndices = new Set(d.indices);

            // Update the global highlightedIndices
            highlightedIndices = hoveredIndices;

            // Highlight respective points in scatterplots
            d3.selectAll(".scatter-plot .scatter-point, .vertical-scatter circle")
                .style("fill", function () {
                    const pointIndex = +d3.select(this).attr("data-index");

                    // Highlight points matching the hovered bar
                    if (hoveredIndices.has(pointIndex)) {
                        return brush_col;
                    }

                    // Determine the original color of non-hovered points
                    const featureKeyY = d3.select(this).node().closest("div").getAttribute("data-feature-y");
                    const featureKeyX = d3.select(this).node().closest("div").getAttribute("data-feature-x");

                    return featureKeyX.startsWith("pred") || featureKeyY.startsWith("pred")
                        ? predictChart_col // Predicted variable color
                        : baseChart_col; // Default scatterplot color

                });

            // Update highlighted bars in other bar charts
            d3.selectAll(".bar-chart").each(function () {
                const barSvg = d3.select(this);
                const categoricalFeature = barSvg.attr("data-feature-x");

                // Skip the hovered chart
                if (categoricalFeature === featureKey) return;

                // Subset data for this bar chart
                const filteredData = dataset.filter((_, i) => hoveredIndices.has(i));
                const subset = d3.rollups(
                    filteredData,
                    v => v.length,
                    d => d[categoricalFeature]
                ).map(([key, value]) => ({ category: key, count: value }));

                // Get affected chart's data and categories
                const affectedData = barSvg.selectAll(".background-bar").data();
                const affectedCategories = affectedData.map(d => d.category);

                // Align subset data with affected chart categories
                const subsetComplete = affectedCategories.map(category => {
                    const found = subset.find(d => d.category === category);
                    return { category, count: found ? found.count : 0 };
                });

                const xAffected = d3.scaleBand()
                    .domain(affectedCategories)
                    .range([margin.left, size - margin.right])
                    .padding(0.1);

                const yAffected = d3.scaleLinear()
                    .domain([0, d3.max(affectedData, d => d.count)])
                    .range([size - margin.bottom, margin.top]);

                // Update highlighted bars
                barSvg.selectAll(".highlighted-bar")
                    .data(subsetComplete, d => d.category)
                    .join(
                        enter => enter.append("rect")
                            .attr("class", "highlighted-bar")
                            .attr("x", d => xAffected(d.category))
                            .attr("y", d => yAffected(d.count))
                            .attr("width", xAffected.bandwidth())
                            .attr("height", d => size - margin.bottom - yAffected(d.count))
                            .attr("fill", brush_col)
                            .style("opacity", 0.7),
                        update => update
                            .attr("x", d => xAffected(d.category))
                            .attr("y", d => yAffected(d.count))
                            .attr("width", xAffected.bandwidth())
                            .attr("height", d => size - margin.bottom - yAffected(d.count)),
                        exit => exit.remove()
                    );
            });

        })
        .on("mouseout", function (event, d) {
            // Reset bar color to gray
            d3.select(this).attr("fill", "#c7c7c7");

            // Clear global highlightedIndices
            highlightedIndices.clear();

            // Clear the hovered bar reference
            currentHoveredBar = null;
            
            // Reset scatterplot points to default color
            d3.selectAll(".scatter-plot .scatter-point, .vertical-scatter circle")
                .style("fill", function () {
                    const featureKeyX = d3.select(this).node().closest("div").getAttribute("data-feature-y");
                    const featureKeyY = d3.select(this).node().closest("div").getAttribute("data-feature-x");

                    // Determine original color
                    return featureKeyX.startsWith('pred') || featureKeyY.startsWith('pred')
                        ? predictChart_col // Predicted variable color
                        : baseChart_col; // Default color
                });

            // Clear highlighted bars in all bar charts
            d3.selectAll(".bar-chart").selectAll(".highlighted-bar").remove();
        });

    // X-axis
    const xAxis = svg.append("g")
        .attr("transform", `translate(0,${size - margin.bottom})`)
        .call(d3.axisBottom(x).tickSize(3));

    // Count the number of categories
    const numCategories = data.length;

    // Rotate tick labels if necessary
    /*
    xAxis.selectAll("text")
        .attr("text-anchor", "end")
        .attr("dx", "0.7em")
        .attr("dy", "0.40em")
        .attr("transform", function () {
            return this.textContent.length > 2 ? "rotate(-20)" : "";
        });
    */

    xAxis.selectAll("text")
    .attr("text-anchor", numCategories > 4 ? "end" : "middle") // Rotate only if more than 4 categories
    .attr("dx", numCategories > 4 ? "0.7em" : "0") 
    .attr("dy", numCategories > 4 ? "0.40em" : "0.35em")
    .attr("transform", function () {
        return numCategories > 4 ? "rotate(-20)" : ""; // Rotate only when necessary
    });

    // Y-axis
    svg.append("g")
        .attr("transform", `translate(${margin.left},0)`)
        .call(d3.axisLeft(y).tickSize(2).ticks(5));

    // X-axis label
    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("x", width / 2 + margin.left)
        .attr("y", size - 5)
        .text(featureName);

    // Y-axis label
    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2 - margin.top)
        .attr("y", 15)
        .text("Count");

    // Add remove button
    addRemoveButton(container);
}


function renderScatterPlot(container, featureX, featureY, featureX_Name, featureY_Name, dataSubset = dataset, lineData = null, classFeature = null, colorScale = null, location = 'visArea') {
        
    if (location != "table") {
        addRemoveButton(d3.select(container));
    }

    //const size = 200;
    //const margin = { top: 10, right: 10, bottom: 40, left: 40 };
    let size;
    let margin;
    let legendSpace = 60;
    let svgWidth = size + legendSpace;
    if (location == 'visArea') {
        size = 200;
        margin = { top: 10, right: 10, bottom: 40, left: 40 };
    } else if (location == 'hoverTable') {
        size = 150;
        margin = { top: 8, right: 8, bottom: 25, left: 25 };
    } else if (location == 'table') {
        size = 50;
        margin = { top: 10/4, right: 10/4, bottom: 10/4, left: 10/4 };
    }
    //const margin = size <= 150 
    //    ? { top: 8, right: 8, bottom: 25, left: 25 }  // smaller margins for small plots
    //    : { top: 10, right: 10, bottom: 40, left: 40 };

    const width = size - margin.left - margin.right;
    const height = size - margin.top - margin.bottom;

    const isPrediction = featureX.startsWith('pred') || featureY.startsWith('pred'); // Check for prediction features
    const isResidual = featureX.startsWith('residual') || featureY.startsWith('residual');

    const plotId = `${featureX}-${featureY}-${Date.now()}`;

    const pointColor = isResidual 
        ? residual_col 
        : (isPrediction ? predictChart_col : baseChart_col);

    // Set the plot type as scatterplot
    d3.select(container)
        .attr("data-plot-type", "scatterplot")
        .attr("data-feature-x", featureX)
        .attr("data-feature-y", featureY)
        .attr("data-plot-id", plotId); 

    const x = d3.scaleLinear()
        .domain(d3.extent(dataSubset, d => +d[featureX]))
        .range([margin.left, width + margin.left]);
    
    const y = d3.scaleLinear()
        .domain(d3.extent(dataSubset, d => +d[featureY]))
        .range([height + margin.top, margin.top]);
    
    // Clear any previous chart wrapper (e.g., from "Prediction" switch)
    d3.select(container).selectAll(".scatter-wrapper").remove();

    // Create a new wrapper for the current chart
    const chartWrapper = document.createElement("div");
    chartWrapper.className = "scatter-wrapper";
    chartWrapper.style.position = "relative";
    chartWrapper.style.width = "100%";
    chartWrapper.style.height = "100%";
    container.appendChild(chartWrapper);


    const svg = d3.select(chartWrapper)
        .append("svg")
        .attr("width", svgWidth)
        .attr("height", size)
        .attr("class", "scatter-plot");

    

    // Create a group for the points
    const pointsGroup = svg.append("g")
        .attr("class", "points-group");

    // sort by brightness if there are multiple colors
    const sortedData = (classFeature && colorScale) 
        ? dataSubset.sort((a, b) => d3.hsl(colorScale(a[classFeature])).l - d3.hsl(colorScale(b[classFeature])).l) 
        : dataSubset;

    // Create circles for scatterplot
    const circles = pointsGroup.selectAll("circle")
        //.data(dataSubset)
        .data(sortedData)
        .enter()
        .append("circle")
        .attr("class", "scatter-point")  // Add class for easier selection
        .attr("cx", d => x(d[featureX]))
        .attr("cy", d => y(d[featureY]))
        .attr("r", location === "table" ? 1 : 3)
        //.attr("fill", pointColor)
        .attr("fill", d => (classFeature && colorScale) ? colorScale(d[classFeature]) : pointColor)
        .attr("data-original-color", d => { // Store color for later use
            return (classFeature && colorScale) ? colorScale(d[classFeature]) : pointColor;
        })
        .attr("opacity", 0.5)
        .attr("data-index", (d, i) => i);  // Store index for linking

    // append horizontal line at zero if it's residual
    if (featureY.startsWith('residual')) {
        svg.append("line")
            .attr("x1", margin.left)
            .attr("x2", width + margin.left)
            .attr("y1", y(0))
            .attr("y2", y(0))
            .attr("stroke", "black")
            .attr("stroke-width", 1)
            .attr("stroke-dasharray", "4 2"); // Dashed line
    }

    // Create axes
    const xAxis = d3.axisBottom(x).tickSize(3);
    const yAxis = d3.axisLeft(y).tickSize(2); 

    // Append axes
    const gX = svg.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0,${height + margin.top})`)
        .call(location != "table" ? xAxis : xAxis.tickValues([]));

    const gY = svg.append("g")
        .attr("class", "y-axis")
        .attr("transform", `translate(${margin.left},0)`)
        .call(location != "table" ? yAxis : yAxis.tickValues([]));

    if (location === "table") {
        gX.selectAll("path").attr("stroke", "#ccc");
        gX.selectAll("line").attr("stroke", "#ccc");
        gX.selectAll("text").attr("fill", "#aaa");

        gY.selectAll("path").attr("stroke", "#ccc");
        gY.selectAll("line").attr("stroke", "#ccc");
        gY.selectAll("text").attr("fill", "#aaa");
    }


    if (location != "table") {
        // Add labels
        const xLabel = svg.append("text")
            .attr("text-anchor", "middle")
            .attr("x", width / 2 + margin.left)
            .attr("y", size - 5)
            .text(featureX_Name);

        const yLabel = svg.append("text")
            .attr("text-anchor", "middle")
            .attr("transform", "rotate(-90)")
            .attr("x", -height / 2)
            .attr("y", 15)
            .text(featureY_Name);
    }
    

    if (lineData && lineData.length > 0) {
        const line = d3.line()
            .x(d => x(+d[featureX]))
            .y(d => y(+d.fit));

        const area = d3.area()
            .x(d => x(+d[featureX]))
            .y0(d => y(+d.lower))
            .y1(d => y(+d.upper));

        // Confidence interval
        svg.append("path")
            .datum(lineData)
            .attr("fill", "#ccc")
            .attr("stroke", "none")
            .attr("opacity", 0.4)
            .attr("d", area);

        // Fitted line
        svg.append("path")
            .datum(lineData)
            .attr("fill", "none")
            .attr("stroke", "red")
            .attr("stroke-width", 1.5)
            .attr("d", line);
    }

    // Add dropdown to top-right corner
    const dropdown = document.createElement("select");
    dropdown.className = "category-color-dropdown";
    dropdown.style.fontSize = "9px";
    dropdown.style.padding = "1px";
    dropdown.style.display = "block";
    dropdown.style.width = "80px"; 

    const allOption = document.createElement("option");
    allOption.value = "all";
    allOption.text = "All";
    allOption.selected = true;
    dropdown.appendChild(allOption);

    features.filter(f => f.type === "categorical").forEach(f => {
        const option = document.createElement("option");
        option.value = f.key;
        option.text = f.name;
        dropdown.appendChild(option);
    });

    dropdown.onchange = function () {
        const selectedKey = this.value;

        if (selectedKey === "all") {
            svg.selectAll(".scatter-point")
                .transition()
                .duration(300)
                .attr("fill", pointColor)
                .attr("data-original-color", pointColor);
        } else {
            const categories = [...new Set(dataSubset.map(d => d[selectedKey]))];
            const colorScale = d3.scaleOrdinal().domain(categories).range(d3.schemeCategory10);

            svg.selectAll(".scatter-point")
                .transition()
                .duration(300)
                .attr("fill", d => colorScale(d[selectedKey]))
                .attr("data-original-color", d => colorScale(d[selectedKey]));
        }


        // legend
        // Remove any previous legend
        svg.selectAll(".legend-group").remove();

        if (selectedKey !== "all") {
            const categories = [...new Set(dataSubset.map(d => d[selectedKey]))];
            const colorScale = d3.scaleOrdinal().domain(categories).range(d3.schemeCategory10);

            const legend = svg.append("g")
                .attr("class", "legend-group control-overlay")
                .attr("transform", `translate(${size + 5}, 40)`)  // to the right of plot
                //.style("display", "none");

                const group = legend.selectAll(".legend-item")
                .data(categories)
                .enter()
                .append("g")
                .attr("class", "legend-item")
                .attr("transform", (d, i) => `translate(0, ${i * 15})`)
                .style("cursor", "pointer")
                .on("mouseover", function (event, d) {
                    svg.selectAll("circle.scatter-point")
                        .transition().duration(100)
                        .style("opacity", p => p[selectedKey] === d ? 0.5 : 0);
            
                    legend.selectAll(".legend-item")
                        .transition().duration(100)
                        .style("opacity", l => l === d ? 1 : 0.3);
                })
                .on("mouseout", () => {
                    svg.selectAll("circle.scatter-point")
                        .transition().duration(100)
                        .style("opacity", 0.5);
            
                    legend.selectAll(".legend-item")
                        .transition().duration(100)
                        .style("opacity", 1);
                });
            
            group.append("circle")
                .attr("r", 4)
                .attr("fill", d => colorScale(d));
            
            group.append("text")
                .attr("x", 10)
                .attr("y", 4)
                .style("font-size", "10px")
                .text(d => d);
            
        }

    };

    // Create display dropdown ("data", "prediction", "both")
    const displayDropdown = document.createElement("select");
    displayDropdown.className = "display-toggle-dropdown";
    displayDropdown.style.fontSize = "9px";
    displayDropdown.style.padding = "1px";
    displayDropdown.style.display = "block";
    displayDropdown.style.width = "80px";

    ["data", "prediction"].forEach(optionText => {
        const option = document.createElement("option");
        option.value = optionText;
        option.text = optionText.charAt(0).toUpperCase() + optionText.slice(1);
        displayDropdown.appendChild(option);
    });

    displayDropdown.onchange = function () {
        const selected = this.value;
    
        // Clear the container content (remove current chart)
        d3.select(container).selectAll(".scatter-wrapper").remove();

        const predicted_key = `pred${predCounter}_1`
        const predictedFeature = features.find(f => f.key === predicted_key);
        console.log(predicted_key);
        console.log(predictedFeature);
    
        if (selected === "prediction") {
            
            renderScatterPlot(container, featureX, predicted_key, featureX_Name, predictedFeature.name, dataSubset);

            
        } else if (selected === "data") {
            // render data plot only
            renderScatterPlot(container, featureX, featureY, featureX_Name, featureY_Name, dataSubset);

        } else {
            const thisContainer = d3.select(container)
                .append("div")
                .attr("class", "plot-container")
                .node();
    
            const predictContainer = d3.select(container)
                .append("div")
                .attr("class", "plot-container")
                .node();
    
            renderScatterPlot(thisContainer, featureX, featureY, featureXName, featureYName, dataSubset);
            renderScatterPlot(predictContainer, featureX, predicted_key, featureXName, predictedFeature.name, dataSubset);
        }

        
    };
    

    if (location === 'visArea') {
        let dropdownWrapper = container.querySelector(".dropdown-wrapper");
        
        // Only create if not already present
        if (!dropdownWrapper) {
            dropdownWrapper = document.createElement("div");
            dropdownWrapper.className = "dropdown-wrapper control-overlay";
            dropdownWrapper.style.position = "absolute";
            dropdownWrapper.style.top = "-10px";
            dropdownWrapper.style.right = "10px";
            //dropdownWrapper.style.display = "none";
            dropdownWrapper.style.display = "flex";
            dropdownWrapper.style.flexDirection = "column";
            dropdownWrapper.style.alignItems = "flex-start";
            dropdownWrapper.style.zIndex = "10";
            dropdownWrapper.style.gap = "2px";
    
            dropdownWrapper.appendChild(displayDropdown);
            dropdownWrapper.appendChild(dropdown);
    
            container.appendChild(dropdownWrapper);
        }
    }
    
    /*
    d3.select(container)
    .on("mouseenter", function () {
        d3.select(container).selectAll(".control-overlay")
            .style("display", function () {
                return this.tagName === "g" ? "block" : "flex";  // for <g> legend vs <div> dropdown
            });
    })
    .on("mouseleave", function () {
        d3.select(container).selectAll(".control-overlay")
            .style("display", "none");
    });
    */
    

    // Create brush behavior
    //if (location != 'table') {
        const brush = d3.brush()
        .extent([[0, 0], [size, size]])
        .on("start", brushStarted)
        //.on("brush", brushed)
        .on("brush", (event) => brushed(event, container))
        .on("end", brushEnded);

        // Add brush to a new group
        svg.append("g")
            .attr("class", "brush")
            .call(brush);
    //}
    

    function brushStarted(event) {
        // If no valid event or source event, exit the function
        if (!event.sourceEvent) return;

        // If this brush is starting, clear all other brushes
        const currentBrush = event.sourceEvent.target;
        
        d3.selectAll(".brush").each(function() {
            // Skip the current brush
            if (this !== currentBrush.parentNode) {
                // Clear the brush
                d3.select(this).call(brush.move, null);
            }
        });

        /*
        const brushContainer = visArea.append("div")
                .attr("class", "plot-container")
                .style("position", "relative")
                .style("width", "200px")
                .style("height", "200px")
                .style("margin", "20px")

        renderBarChart(brushContainer.node(), "class", "Class");
        */
    }

    function brushed(event, container) {
        if (!event.selection) return; // Skip if no selection
        
        // Get the brush selection coordinates
        const [[x0, y0], [x1, y1]] = event.selection;
        
        // Clear the global highlightedIndices
        highlightedIndices.clear();

        zoomedData = dataSubset.filter(d => {
            const cx = x(d[featureX]);
            const cy = y(d[featureY]);
            return cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1;
        });

        // Update highlight
        //pointsGroup.selectAll(".scatter-point").attr("opacity", d => zoomedData.includes(d) ? 1 : 0.2);

        //zoomButton.style("background", zoomedData.length > 0 ? "#d3d3d3" : "#eee");

        pointsGroup.selectAll(".scatter-point").each(function(d, i) {
            const circle = d3.select(this);
            const cx = +circle.attr("cx");
            const cy = +circle.attr("cy");
            
            if (cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1) {
                highlightedIndices.add(i);
            }
        });

        // Update the visual highlights
        updateHighlights();

        // storing brushed data
        const brushedIndices = [];
        const brushedData = [];

        dataSubset.forEach((d, i) => {
            const cx = x(d[featureX]);
            const cy = y(d[featureY]);
            if (cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1) {
                const originalIndex = dataset.indexOf(d);  // Index in full dataset
                brushedIndices.push(originalIndex);
                brushedData.push(d);
            }
        });

        brushedPointsByPlot[plotId] = { data: brushedData, indices: brushedIndices };

        // Remove old button if it exists
        d3.select(container).select(".expand-button").remove();
        console.log(brushedData)
        // Only show if there are brushed points
        if (brushedData.length > 0) {
            console.log("appending expand button")
            const expandBtn = d3.select(container)
                .append("button")
                .attr("class", "expand-button")
                .text("Expand")
                .style("position", "absolute")
                .style("bottom", "5px")
                .style("right", "5px")
                .style("font-size", "10px")
                .style("padding", "2px 6px")
                .style("z-index", "10")
                .on("click", () => {
                    createExpandedScatterplot(container, featureX, featureY, featureX_Name, featureY_Name, brushedData);
                    expandBtn.remove(); // remove button after clicking
                });
        }



    }

    function brushEnded(event) {
        if (!event.selection) {
            zoomedData = dataSubset;
            //zoomButton.style("background", "#eee");
            // If no selection, reset all points across all plots
            d3.selectAll(".scatter-plot .scatter-point")
                .style("fill", function () {
                    const featureKeyY = d3.select(this).node().closest("div").getAttribute("data-feature-y");
                    const featureKeyX = d3.select(this).node().closest("div").getAttribute("data-feature-x");

                    let originalColor = d3.select(this).attr("data-original-color");

                    // Determine original color
                    return featureKeyX.startsWith('pred') || featureKeyY.startsWith('pred')
                        ? predictChart_col // Predicted variable color
                        : originalColor; // original color
                });

            // Clear frequency highlights
            d3.selectAll(".highlighted-bar.frequency").remove();

            // Reset average bars to the full dataset
            d3.selectAll(".bar-chart").each(function () {
                const barSvg = d3.select(this);
                const categoricalFeature = barSvg.attr("data-feature-x");
                const continuousFeature = barSvg.attr("data-continuous-feature");

                if (continuousFeature) {
                    // Compute averages for the full dataset
                    const fullDataAverages = d3.rollups(
                        dataSubset,
                        v => d3.mean(v, d => +d[continuousFeature]),
                        d => d[categoricalFeature]
                    ).map(([key, value]) => ({ category: key, average: value || 0 }));

                    const allCategories = fullDataAverages.map(d => d.category);

                    const margin = { top: 10, right: 10, bottom: 40, left: 40 };
                    const size = 200;

                    const x = d3.scaleBand()
                        .domain(allCategories)
                        .range([margin.left, size - margin.right])
                        .padding(0.1);

                    const yAverage = d3.scaleLinear()
                        .domain([0, d3.max(fullDataAverages, d => d.average) || 1])
                        .range([size - margin.bottom, margin.top]);

                    // Update average bars
                    barSvg.selectAll("rect")
                        .data(fullDataAverages, d => d.category)
                        .join(
                            enter => enter.append("rect")
                                .attr("x", d => x(d.category))
                                .attr("y", d => yAverage(d.average))
                                .attr("width", x.bandwidth())
                                .attr("height", d => size - margin.bottom - yAverage(d.average))
                                .attr("fill", "blue"),
                            update => update
                                .attr("y", d => yAverage(d.average))
                                .attr("height", d => size - margin.bottom - yAverage(d.average)),
                            exit => exit.remove()
                        );

                    // Reset y-axis
                    barSvg.select(".y-axis").call(d3.axisLeft(yAverage).tickSize(2));

                    // Reset x-axis (optional, for consistency)
                    barSvg.select(".x-axis")
                        .attr("transform", `translate(0,${size - margin.bottom})`)
                        .call(d3.axisBottom(x).tickSize(3));
                }
            });


        }
    }

    // drop categorical feature
    d3.select(container)
        .on("dragover", event => event.preventDefault())
        .on("dragover", function (event) {
            event.preventDefault();
            // Add a visual border
            d3.select(this)
                .style("border", "2px dashed #666")
                .style("border-radius", "8px");
        })
        .on("dragleave", function (event) {
            // Remove the border when dragging leaves the area
            d3.select(this).style("border", null);
        })
        .on("drop", function(event) {
            event.preventDefault();
            d3.select(this).style("border", null);

            const feature = JSON.parse(event.dataTransfer.getData("feature"));

            // Only handle categorical feature drops
            if (feature.type !== "categorical") return;

            const container = this;
            const parentArea = container.parentNode;

            // Get current x and y from the container's attributes
            const xFeature = d3.select(container).attr("data-feature-x");
            const yFeature = d3.select(container).attr("data-feature-y");

            // Ensure this container is a scatterplot
            const plotType = d3.select(container).attr("data-plot-type");
            if (plotType !== "scatterplot") return;

            // Remove the current scatterplot
            d3.select(container).remove();

            const categories = [...new Set(dataset.map(d => d[feature.key]))];
            const colorScale = d3.scaleOrdinal().domain(categories).range(d3.schemeCategory10);

            categories.forEach(category => {
                const filteredData = dataset.filter(d => d[feature.key] === category);

                const chartId = `chart-${xFeature}-${category}-${Date.now()}`;
                const newContainer = d3.select(parentArea)
                    .append("div")
                    .attr("class", "plot-container")
                    .attr("id", chartId)
                    .attr("draggable", true)
                    .attr("data-feature-x", xFeature)
                    .attr("data-feature-y", yFeature)
                    .attr("data-plot-type", "scatterplot")
                    .style("position", "relative")
                    .style("width", "290px")
                    .style("height", "200px")
                    .style("margin-left", "10px")
                    .style("margin-top", "20px")
                    .style("margin-right", "10px")
                    .style("margin-bottom", "20px")
                    .node();

                renderScatterPlot(
                    newContainer,
                    xFeature,
                    yFeature,
                    features.find(f => f.key === xFeature)?.name || xFeature,
                    features.find(f => f.key === yFeature)?.name || yFeature,
                    filteredData,
                    null,
                    d3.scaleOrdinal().domain([category]).range([colorScale(category)])
                );

                // labels
                d3.select(newContainer)
                    .append("div")
                    .style("position", "absolute")
                    .style("top", "3px")
                    .style("right", "5px")
                    .style("background", "#eee")
                    .style("padding", "2px 6px")
                    .style("font-size", "10px")
                    .style("border-radius", "3px")
                    .text(category);
            });
        });

}


function renderAverageBarChart(container, categoricalFeature, continuousFeature, cateName, contName, dataSubset = dataset) {
    addRemoveButton(d3.select(container));
    d3.select(container).style("position", "relative");

    // Add chart type switch dropdown
    const dropdown = document.createElement("select");
    dropdown.className = "chart-switch";
    dropdown.style.position = "absolute";
    dropdown.style.top = "-15px";
    dropdown.style.right = "4px";
    dropdown.style.fontSize = "10px";

    ["avg-bar", "v-scatter"].forEach(type => {
        const option = document.createElement("option");
        option.value = type;
        option.textContent = type === "avg-bar" ? "Average" : "Distribution";
        dropdown.appendChild(option);
    });

    container.appendChild(dropdown);

    dropdown.onchange = (e) => {
        const selected = e.target.value;
        const containerParent = e.target.parentNode;

        // Clear current chart
        containerParent.querySelector("svg")?.remove();
        containerParent.querySelector(".remove-btn")?.remove(); // remove previous remove button

        // Re-render based on selection
        if (selected === "avg-bar") {
            renderAverageBarChart(containerParent, categoricalFeature, continuousFeature, cateName, contName, dataSubset);
        } else if (selected === "v-scatter") {
            renderVerticalScatterPlot(containerParent, categoricalFeature, continuousFeature, cateName, contName, dataSubset);
        }
    };


    const size = 200;
    const margin = { top: 10, right: 10, bottom: 40, left: 40 };
    const width = size - margin.left - margin.right;
    const height = size - margin.top - margin.bottom;

    d3.select(container)
        .attr("data-plot-type", "avg-bar")
        .attr("data-feature-x", categoricalFeature)
        .attr("data-feature-y", continuousFeature)
        .classed("bar-chart", true);;

    const isPrediction = continuousFeature.startsWith('pred');
    const pointColor = isPrediction ? predictChart_col : bar_col;

    // Compute mean and confidence interval
    const grouped = d3.rollups(
        dataSubset,
        v => {
            const n = v.length;
            const mean = d3.mean(v, d => +d[continuousFeature]);
            const std = d3.deviation(v, d => +d[continuousFeature]);
            const se = std / Math.sqrt(n);
            const margin = 1.96 * se; // ~95% CI
            return {
                mean,
                n,
                lower: mean - margin,
                upper: mean + margin
            };
        },
        d => d[categoricalFeature]
    );
    

    // Sort based on custom order if available, else alphabetical
    const data = grouped
        .sort((a, b) => {
            const customOrder = customCategoryOrder[categoricalFeature];
            if (customOrder) {
                return customOrder.indexOf(a[0]) - customOrder.indexOf(b[0]);
            }
            return d3.ascending(a[0], b[0]);
        })
        .map(([category, stats]) => ({ category, ...stats }));

    const x = d3.scaleBand()
        .domain(data.map(d => d.category))
        .range([margin.left, width + margin.left])
        .padding(0.1);

    const y = d3.scaleLinear()
        .domain([
            Math.min(0, d3.min(data, d => d.lower)),
            d3.max(data, d => d.upper)
        ])
        .nice()
        .range([height + margin.top, margin.top]);

    const svg = d3.select(container).append("svg")
        .attr("width", size)
        .attr("height", size)
        .attr("class", "bar-chart")
        .attr("data-feature-x", categoricalFeature)
        .attr("data-continuous-feature", continuousFeature);

    // Average bars
    svg.selectAll("rect")
        .data(data)
        .enter()
        .append("rect")
        .attr("x", d => x(d.category))
        .attr("y", d => Math.min(y(d.mean), y(0)))
        .attr("width", x.bandwidth())
        .attr("height", d => Math.abs(y(d.mean) - y(0)))
        .attr("fill", pointColor)
        .attr("opacity", 0.7)
        .attr("data-category", d => d.category);

    /*
    // Error bars
    const errorBarWidth = x.bandwidth() / 4;

    svg.selectAll(".error-line")
        .data(data)
        .enter()
        .append("line")
        .attr("class", "error-line")
        .attr("x1", d => x(d.category) + x.bandwidth() / 2)
        .attr("x2", d => x(d.category) + x.bandwidth() / 2)
        .attr("y1", d => y(d.lower))
        .attr("y2", d => y(d.upper))
        .attr("stroke", "black")
        .attr("stroke-width", 1.2);

    // Error bar caps (top & bottom)
    svg.selectAll(".error-cap-top")
        .data(data)
        .enter()
        .append("line")
        .attr("x1", d => x(d.category) + x.bandwidth() / 2 - errorBarWidth / 2)
        .attr("x2", d => x(d.category) + x.bandwidth() / 2 + errorBarWidth / 2)
        .attr("y1", d => y(d.upper))
        .attr("y2", d => y(d.upper))
        .attr("stroke", "black")
        .attr("stroke-width", 1);

    svg.selectAll(".error-cap-bottom")
        .data(data)
        .enter()
        .append("line")
        .attr("x1", d => x(d.category) + x.bandwidth() / 2 - errorBarWidth / 2)
        .attr("x2", d => x(d.category) + x.bandwidth() / 2 + errorBarWidth / 2)
        .attr("y1", d => y(d.lower))
        .attr("y2", d => y(d.lower))
        .attr("stroke", "black")
        .attr("stroke-width", 1);
    */
   
    // Axes
    const xAxis = svg.append("g")
    .attr("transform", `translate(0,${y(0)})`)
        .call(d3.axisBottom(x).tickSize(3));

    const numCategories = data.length;
    xAxis.selectAll("text")
        .attr("text-anchor", numCategories > 4 ? "end" : "middle")
        .attr("dx", numCategories > 4 ? "0.7em" : "0")
        .attr("dy", numCategories > 4 ? "0.40em" : "0.35em")
        .attr("transform", numCategories > 4 ? "rotate(-20)" : "");

    svg.append("g")
        .attr("transform", `translate(${margin.left},0)`)
        .call(d3.axisLeft(y).tickSize(2));

    // Labels
    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("x", width / 2 + margin.left)
        .attr("y", size - 5)
        .text(cateName);

    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2 - margin.top)
        .attr("y", 15)
        .text(`Avg. ${contName}`);


    // drop categorical feature on avg-bar chart
    d3.select(container)
        .on("dragover", event => event.preventDefault())
        .on("dragover", function (event) {
            event.preventDefault();
            d3.select(this)
                .style("border", "2px dashed #666")
                .style("border-radius", "8px");
        })
        .on("dragleave", function (event) {
            d3.select(this).style("border", null);
        })
        .on("drop", function (event) {
            event.preventDefault();
            d3.select(this).style("border", null);

            const feature = JSON.parse(event.dataTransfer.getData("feature"));
            if (feature.type !== "categorical") return;

            const container = this;
            const parentArea = container.parentNode;

            // Ensure this container is an average bar chart
            const plotType = d3.select(container).attr("data-plot-type");
            if (plotType !== "avg-bar") return;

            // Get the original feature keys
            const xFeature = d3.select(container).attr("data-feature-x");  // categorical
            const yFeature = d3.select(container).select("svg").attr("data-continuous-feature"); // continuous

            if (!xFeature || !yFeature) return;

            // Remove the original average bar chart
            d3.select(container).remove();

            // Get all categories and sort alphabetically or via custom order
            let categories = [...new Set(dataset.map(d => d[feature.key]))];

            const customOrder = customCategoryOrder[feature.key];
            if (customOrder) {
                categories = customOrder.filter(cat => categories.includes(cat));
            } else {
                categories.sort(); // fallback: alphabetical
            }

            categories.forEach(category => {
                const filteredData = dataset.filter(d => d[feature.key] === category);
                const chartId = `chart-${xFeature}-${category}-${Date.now()}`;
                const newContainer = d3.select(parentArea)
                    .append("div")
                    .attr("class", "plot-container")
                    .attr("id", chartId)
                    .attr("draggable", true)
                    .attr("data-feature-x", xFeature)
                    .attr("data-feature-y", yFeature)
                    .attr("data-plot-type", "avg-bar")
                    .style("position", "relative")
                    .style("width", "200px")
                    .style("height", "200px")
                    .style("margin", "20px")
                    .node();

                renderAverageBarChart(
                    newContainer,
                    xFeature,
                    yFeature,
                    features.find(f => f.key === xFeature)?.name || xFeature,
                    features.find(f => f.key === yFeature)?.name || yFeature,
                    filteredData
                );

                // Add category label
                d3.select(newContainer)
                    .append("div")
                    .style("position", "absolute")
                    .style("top", "3px")
                    .style("right", "5px")
                    .style("background", "#eee")
                    .style("padding", "2px 6px")
                    .style("font-size", "10px")
                    .style("border-radius", "3px")
                    .text(category);
            });
        });

}


function renderVerticalScatterPlot(container, categoricalFeature, continuousFeature, cateName, contName, dataSubset = dataset) {

    const size = 200;
    const margin = { top: 10, right: 10, bottom: 40, left: 40 };
    const width = size - margin.left - margin.right;
    const height = size - margin.top - margin.bottom;

    d3.select(container)
        .attr("data-plot-type", "vertical-scatter")
        .attr("data-feature-y", categoricalFeature);

    const isPrediction = continuousFeature.startsWith('pred');
    const pointColor = isPrediction ? predictChart_col : baseChart_col;

    // Extract categories and apply custom or alphabetical ordering
    let categories = [...new Set(dataSubset.map(d => d[categoricalFeature]))];

    const customOrder = customCategoryOrder[categoricalFeature];
    if (customOrder) {
        categories = customOrder.filter(cat => categories.includes(cat));
    } else {
        categories.sort();
    }

    const x = d3.scaleBand()
        .domain(categories)
        .range([margin.left, width + margin.left])
        .padding(0.5); // Add space between categories

    const y = d3.scaleLinear()
        .domain(d3.extent(dataset, d => +d[continuousFeature]))
        .range([height + margin.top, margin.top]);

    const svg = d3.select(container).append("svg")
        .attr("width", size)
        .attr("height", size)
        .attr("class", "vertical-scatter");

    const jitterWidth = x.bandwidth() * 0.6;

    svg.selectAll("circle")
        .data(dataSubset)
        .enter()
        .append("circle")
        .attr("cx", d => x(d[categoricalFeature]) + x.bandwidth() / 2 + (Math.random() - 0.5) * jitterWidth)
        .attr("cy", d => y(+d[continuousFeature]))
        .attr("r", 2)
        .attr("fill", pointColor)
        .attr("opacity", 0.3)
        .attr("data-index", (d, i) => i); // for brushing/linking

    // X-axis
    const xAxis = svg.append("g")
        .attr("transform", `translate(0,${height + margin.top})`)
        .call(d3.axisBottom(x).tickSize(3));

    const numCategories = x.domain().length;
    xAxis.selectAll("text")
        .attr("text-anchor", numCategories > 4 ? "end" : "middle")
        .attr("dx", numCategories > 4 ? "0.7em" : "0")
        .attr("dy", numCategories > 4 ? "0.40em" : "0.35em")
        .attr("transform", numCategories > 4 ? "rotate(-20)" : "");

    // Y-axis
    svg.append("g")
        .attr("transform", `translate(${margin.left},0)`)
        .call(d3.axisLeft(y).tickSize(2));

    // Labels
    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("x", width / 2 + margin.left)
        .attr("y", size - 5)
        .text(cateName);

    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2 - margin.top)
        .attr("y", 15)
        .text(contName);
}


function combinePlots(feature1, feature2, targetContainer, draggedChartId) {
        
    // Check if both features are the same, do not merge
    if (feature1.key === feature2.key) {
        return;
    }

    const isFeature1Continuous = feature1.type === "continuous";
    const isFeature2Continuous = feature2.type === "continuous";

    // Remove the dragged chart container
    
    const draggedFeatureKey = feature1.key;

    if (draggedChartId) {
        d3.select(`#${draggedChartId}`).remove();
    }
    // Clear existing plots in the container
    d3.select(targetContainer).selectAll("*").remove();

    /*
    // Re-add dataset status label after merging
    d3.select(targetContainer)
        .append("div")
        .attr("class", "dataset-status")
        .style("text-align", "center")
        .style("font-size", "12px")
        .style("font-weight", "bold")
        .style("margin-bottom", "5px")
        .text(document.getElementById("filter-message").textContent);
    */
    
    if (isFeature1Continuous && isFeature2Continuous) {

        renderScatterPlot(targetContainer, feature1.key, feature2.key, feature1.name, feature2.name);
    
    } else if (isFeature1Continuous && !isFeature2Continuous) {
    
        renderAverageBarChart(targetContainer, feature2.key, feature1.key, feature2.name, feature1.name);
    
    } else if (!isFeature1Continuous && isFeature2Continuous) {
    
        renderAverageBarChart(targetContainer, feature1.key, feature2.key, feature1.name, feature2.name);

    } else {
        alert("Cannot combine two categorical variables");
    }
    
}

function updateHighlights(classFeature = null, colorScale = null) {
    console.log("update highlights")
    // Update ALL scatter plots (change colors of they are brushed points)
    d3.selectAll(".scatter-plot .scatter-point")
        .style("fill", function () {
            
            const featureKeyX = d3.select(this).node().closest("div").getAttribute("data-feature-y");
            const featureKeyY = d3.select(this).node().closest("div").getAttribute("data-feature-x");
            const pointIndex = +d3.select(this).attr("data-index");

            const isPrediction = featureKeyX.startsWith('pred') || featureKeyY.startsWith('pred');
            const isResidual = featureKeyX.startsWith('residual') || featureKeyY.startsWith('residual');

            if (highlightedIndices.has(pointIndex)) {
                return brush_col; // Highlight color
            }
            /*
            return isResidual 
                ? residual_col 
                : (isPrediction ? predictChart_col : baseChart_col);
            
            // Determine the original color before highlighting
            const originalColor = isResidual 
                ? residual_col 
                : (isPrediction ? predictChart_col : (classFeature && colorScale) ? colorScale(d[classFeature]) : baseChart_col);
            */
            let originalColor = d3.select(this).attr("data-original-color");
            if (isResidual) {
                originalColor = residual_col;
            }
            // If highlighted, change to brush color
            return highlightedIndices.has(pointIndex) ? brush_col : originalColor;

            /*if (featureKeyX.startsWith('pred') || featureKeyY.startsWith('pred')){
                return highlightedIndices.has(pointIndex) ? brush_col : predictChart_col;
            } else {
                return highlightedIndices.has(pointIndex) ? brush_col : baseChart_col;
            }*/

        });

    // Update all histogram bars
    /*
    d3.selectAll(".histogram-bar")
        .style("fill", function(d) {
            const binIndices = d.indices || [];
            const featureKeyX =d3.select(this).node().closest("div").getAttribute("data-feature-x");
            //return binIndices.some(index => highlightedIndices.has(index)) ? brush_col : bar_col;
            const defaultColor = featureKeyX.startsWith("pred") ? predictChart_col : baseChart_col;
            const isHighlighted = binIndices.some(index => highlightedIndices.has(index));
            return isHighlighted ? brush_col : defaultColor;

        });
    */

    // Loop through all distribution plots
    d3.selectAll('.plot-container[data-plot-type="distribution"]').each(function () {
        console.log("selecting histograms")

        const container = d3.select(this);
        const featureKey = container.attr("data-feature-x");
        const svg = container.select("svg");

        console.log("Rendering overlay for", featureKey);

    
        // Remove old highlighted bars
        svg.selectAll(".highlighted-bar").remove();
        console.log("SVG found?", !svg.empty());

        // Assume original scale setup
        const size = +svg.attr("width");
        const margin = { top: 10, right: 10, bottom: 40, left: 40 };
    
        const x = d3.scaleLinear()
            .domain(d3.extent(dataset, d => +d[featureKey]))  // Try to match original domain
            .nice()
            .range([margin.left, size - margin.right]);
                
        console.log("Highlighted indices:", [...highlightedIndices]);
  
        const domain = x.domain();
        const filtered = [];
            highlightedIndices.forEach(i => {
                const val = +dataset[i][featureKey];
                if (val >= domain[0] && val <= domain[1]) {
                    filtered.push({ value: val, index: i });
                }
            });
    
        const bins = d3.histogram()
            .domain(domain)
            .thresholds(10)
            .value(d => d.value)(filtered);

        console.log("Filtered bins:", bins.length);
        console.log("bins:", bins);
        console.log(filtered.length)

        const y = d3.scaleLinear()
            .domain([0, d3.max(bins, d => d.length)])
            .nice()
            .range([size - margin.bottom, margin.top]);
    
        // Overlay new highlighted bars
        svg.append("g")
            .selectAll("rect")
            .data(bins)
            .enter().append("rect")
            .attr("class", "highlighted-bar")
            .attr("x", d => {
                console.log("Drawing bin:", d); 
                return x(d.x0) + 1;
            })
            //.attr("y", d => y(d.length))
            .attr("y", d => Math.min(y(0), y(d.length)))
            .attr("width", d => Math.max(1, x(d.x1) - x(d.x0) - 1))
            //.attr("height", d => y(0) - y(d.length))
            .attr("height", d => Math.abs(y(0) - y(d.length)))
            .attr("fill", "purple")
            .attr("opacity", 0.5);


        
        
    });
    

    

    // Update bar charts (frequency-based and average-based)
    d3.selectAll(".highlighted-bar").remove(); // Clear old highlights
    d3.selectAll(".bar-chart").each(function () {
        const barSvg = d3.select(this);
        const categoricalFeature = barSvg.attr("data-feature-x");
        const continuousFeature = barSvg.attr("data-continuous-feature");

        const isFrequencyChart = !continuousFeature; // If no continuous feature, it's a frequency chart
        const isAverageChart = !!continuousFeature; // If continuous feature exists, it's an average chart

        const filteredData = dataset.filter((_, i) => highlightedIndices.has(i));
        
        // Frequency Chart Update
        if (isFrequencyChart) {
            const brushedDataCounts = d3.rollups(
                filteredData,
                v => v.length,
                d => d[categoricalFeature]
            ).map(([key, value]) => ({ category: key, count: value }));

            const margin = { top: 10, right: 10, bottom: 40, left: 40 };
            const size = 200;

            const x = d3.scaleBand()
                .domain(barSvg.selectAll(".background-bar").data().map(d => d.category))
                .range([margin.left, size - margin.right])
                .padding(0.1);

            const yFrequency = d3.scaleLinear()
                .domain([0, d3.max(barSvg.selectAll(".background-bar").data(), d => d.count)])
                .range([size - margin.bottom, margin.top]);

            barSvg.selectAll(".highlighted-bar.frequency")
                .data(brushedDataCounts, d => d.category)
                .join(
                    enter => enter.append("rect")
                        .attr("class", "highlighted-bar frequency")
                        .attr("x", d => x(d.category))
                        .attr("y", d => yFrequency(d.count))
                        .attr("width", x.bandwidth())
                        .attr("height", d => size - margin.bottom - yFrequency(d.count))
                        .attr("fill", brush_col)
                        .style("opacity", 0.7),
                    update => update
                        .attr("y", d => yFrequency(d.count))
                        .attr("height", d => size - margin.bottom - yFrequency(d.count)),
                    exit => exit.remove()
                );
        }

        // Average Chart Update
        if (isAverageChart && (filteredData.length > 0) ) {
            const brushedDataAverages = d3.rollups(
                filteredData,
                v => d3.mean(v, d => +d[continuousFeature]),
                d => d[categoricalFeature]
            ).map(([key, value]) => ({ category: key, average: value || 0 }));

            
            const allCategories = d3.rollups(
                dataSubset,
                v => d3.mean(v, d => +d[continuousFeature]),
                d => d[categoricalFeature]
            ).map(([key, value]) => ({ category: key, average: value || 0 })).map(d => d.category);
            
            const completeAveragesData = allCategories.map(category => {
                const found = brushedDataAverages.find(d => d.category === category);
                return { category, average: found ? found.average : 0 }; // Fallback to 0 for missing categories
            });

            const margin = { top: 10, right: 10, bottom: 40, left: 40 };
            const size = 200;

            const x = d3.scaleBand()
                .domain(barSvg.selectAll(".background-bar").data().map(d => d.category))
                .range([margin.left, size - margin.right])
                .padding(0.1);

            const yAverage = d3.scaleLinear()
                .domain([0, d3.max(completeAveragesData, d => d.average) || 1])
                .range([size - margin.bottom, margin.top]);

                barSvg.selectAll("rect")
                .data(completeAveragesData, d => d.category)
                .join(
                    enter => enter.append("rect")
                        .attr("x", d => x(d.category))
                        .attr("y", d => yAverage(d.average))
                        .attr("width", x.bandwidth())
                        .attr("height", d => size - margin.bottom - yAverage(d.average))
                        .attr("fill", "blue"),
                    update => update
                        .attr("y", d => yAverage(d.average))
                        .attr("height", d => size - margin.bottom - yAverage(d.average)),
                    exit => exit.remove()
                );

            const yAxis = d3.axisLeft(yAverage).tickSize(2);
            barSvg.select(".y-axis")
                .call(yAxis);
        }
    });

}


function renderPlot(area, feature) {
    const chartId = `chart-${feature.key}-${Date.now()}`;
    const thisContainer = area.append("div")
        .attr("class", "plot-container")
        .attr("id", chartId) 
        .attr("draggable", true)
        .style("position", "relative")
        .style("width", "290px")
        .style("height", "200px")
        .style("margin-left", "10px")
        .style("margin-top", "20px")
        .style("margin-right", "10px")
        .style("margin-bottom", "20px")
        .attr("data-feature-x", feature.key)  // Store feature key for combining
        .on("dragstart", function(event) {
            event.dataTransfer.setData("draggedFeature", JSON.stringify(feature));
            event.dataTransfer.setData("chartId", chartId);
        })
        .on("dragover", event => event.preventDefault())
        .on("drop", function(event) {
            event.preventDefault();
            const draggedFeature = JSON.parse(event.dataTransfer.getData("draggedFeature"));
            const draggedChartId = event.dataTransfer.getData("chartId");
            const targetFeatureKey = d3.select(this).attr("data-feature-x");
            const targetFeature = features.find(f => f.key === targetFeatureKey);

            combinePlots(draggedFeature, targetFeature, this, draggedChartId);
        })
        .node();

    if (feature.type === "continuous") {
        renderDistributionPlot(thisContainer, feature.key, feature.name);
    } else if (feature.type === "categorical") {
        renderBarChart(thisContainer, feature.key, feature.name);
    }

    /*
        // Append dataset status label
        d3.select(plotContainer).append("div")
            .attr("class", "dataset-status")
            .style("text-align", "center")
            .style("font-size", "12px")
            .style("font-weight", "bold")
            .style("margin-bottom", "5px")
            .text(document.getElementById("filter-message").textContent); 
        */

}

function addRemoveButton(container) {
    container.append("div")
        .attr("class", "remove-button")
        .style("position", "absolute")
        .style("top", "-15px")
        .style("left", "5px")
        .style("width", "18px")
        .style("height", "18px")
        .style("background", "lightgrey")
        .style("color", "black")
        .style("text-align", "center")
        .style("border-radius", "50%")
        .style("cursor", "pointer")
        .text("X")
        .on("click", function () {
            const plotType = container.attr("data-plot-type"); // Get plot type
            container.remove(); // Remove the chart
        });
        
}


function toggleHOPs() {
    const button = document.getElementById("toggleHOPsBtn");

    if (isCycling) {
        clearInterval(predictionInterval);
        predictionInterval = null;
        isCycling = false;
        button.textContent = "Activate HOPs";
        button.classList.remove("active");
    } else {
        isCycling = true;
        button.textContent = "Deactivate HOPs";
        button.classList.add("active");

        predictionInterval = setInterval(() => {
            const savedHighlights = new Set(highlightedIndices);

            d3.selectAll(".plot-container").each(function () {
                const container = this;
                const featureKey = d3.select(container).attr("data-feature-x");
                const otherFeatureKey = d3.select(container).attr("data-feature-y");
                const plotType = d3.select(container).attr("data-plot-type");

                const newFeatureKey = featureKey.startsWith("pred") || featureKey.startsWith("residual")
                    ? `${featureKey.split("_")[0]}_${currentPredictionIndex}`
                    : featureKey;

                const newOtherFeatureKey = otherFeatureKey && (otherFeatureKey.startsWith("pred") || otherFeatureKey.startsWith("residual"))
                    ? `${otherFeatureKey.split("_")[0]}_${currentPredictionIndex}`
                    : otherFeatureKey;

                if (featureKey !== newFeatureKey || otherFeatureKey !== newOtherFeatureKey) {
                    const feature = features.find(f => f.key === newFeatureKey);
                    const otherFeature = features.find(f => f.key === newOtherFeatureKey);

                    if (feature) {
                        d3.select(container).selectAll("*").remove();

                        if (plotType === "scatterplot") {
                            renderScatterPlot(container, newOtherFeatureKey, newFeatureKey, otherFeature.name, feature.name);
                        } else if (plotType === "distribution") {
                            renderDistributionPlot(container, newFeatureKey, feature.name);
                        } else if (plotType === "bar-chart") {
                            renderBarChart(container, newFeatureKey, feature.name);
                        } else if (plotType === "avg-bar") {
                            renderAverageBarChart(container, newOtherFeatureKey, newFeatureKey, otherFeature.name, feature.name);
                        }
                    }
                }
            });

            if (currentHoveredBar) {
                d3.select(currentHoveredBar).dispatch("mouseover");
            }

            highlightedIndices = savedHighlights;
            currentPredictionIndex = (currentPredictionIndex % 5) + 1;
            updateHighlights();
        }, 1000);
    }
}


function createExpandedScatterplot(container, featureX, featureY, featureXName, featureYName, brushedData) {
    const parentArea = container.parentNode;

    const newContainer = d3.select(parentArea)
        .append("div")
        .attr("class", "plot-container")
        .style("position", "relative")
        .style("width", "290px")
        .style("height", "200px")
        .style("margin", "20px")
        .node();

    renderScatterPlot(
        newContainer,
        featureX,
        featureY,
        featureXName,
        featureYName,
        brushedData // <- subset only
    );
}
