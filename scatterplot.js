function renderScatterPlot(container, featureX, featureY, featureX_Name, featureY_Name, dataSubset = dataset, lineData = null, classFeature = null, colorScale = null, location = 'visArea') {
    
    const isPrediction = featureX.startsWith('pred') || featureY.startsWith('pred');
    const isResidual = featureX.startsWith('residual') || featureY.startsWith('residual');

    const pointColor = isResidual 
        ? residual_col 
        : (isPrediction ? predictChart_col : baseChart_col);

    if (location != "table") {
        addRemoveButton(d3.select(container));
    }

    container = d3.select(container);

    const predicted_key = `pred${predCounter}_1`;
    const predictedFeature = features.find(f => f.key === predicted_key);

    const plotId = `${featureX}-${featureY}-${Date.now()}`;

    //const plotKey = `${featureX}-${featureY}-${Date.now()}`;
    container.attr("data-plot-type", "scatterplot")
             .attr("data-feature-x", featureX)
             .attr("data-feature-y", featureY)
             .attr("data-plot-id", plotId);
             
    
    if (location == 'visArea') {

    // Button wrapper above the chart
    const buttonWrapper = document.createElement("div");
    buttonWrapper.style.position = "absolute";
    buttonWrapper.style.top = "-15px";
    buttonWrapper.style.left = "50px";
    buttonWrapper.style.display = "flex";
    buttonWrapper.style.gap = "5px";
    buttonWrapper.style.zIndex = "20";

    const buttons = {};
    ["data", "prediction"].forEach(name => {
        const btn = document.createElement("button");
        btn.textContent = name;
        btn.style.fontSize = "10px";
        btn.style.padding = "2px 6px";
        btn.style.border = "1px solid #ccc";
        btn.style.borderRadius = "4px";
        btn.style.background = "#f4f4f4";
        btn.style.cursor = "pointer";

        if (name === "data") {
            btn.classList.add("active-toggle");
            btn.style.background = "rgba(105, 179, 162, 0.4)";
            btn.style.fontWeight = "bold";
        }

        btn.onclick = () => {
            const isActive = btn.classList.contains("active-toggle");
            btn.classList.toggle("active-toggle");
            if (name === "data") {
                btn.style.background = isActive ? "#f4f4f4" : "rgba(105, 179, 162, 0.4)";  
            } else {
                btn.style.background = isActive ? "#f4f4f4" : "rgba(0, 150, 255, 0.3)";  
            }
            btn.style.fontWeight = isActive ? "normal" : "bold";

            // Re-render chart based on selected buttons
            container.selectAll("svg").remove();

            const dataActive = buttons["data"].classList.contains("active-toggle");
            const predActive = buttons["prediction"].classList.contains("active-toggle");

            // Show toggle only when prediction is active
            hopToggle.style.display = predActive ? "flex" : "none";

            if (dataActive && predActive) {
                drawSuperimposedScatterPlot(container.node(), featureX, featureY, predicted_key, featureX_Name, predictedFeature.name, dataSubset);
            } else if (dataActive) {
                drawScatterPlot(container.node(), featureX, featureY, featureX_Name, featureY_Name, dataSubset, baseChart_col, location);
            } else if (predActive) {
                drawScatterPlot(container.node(), featureX, predicted_key, featureX_Name, predictedFeature.name, dataSubset, predictChart_col, location);
            }
        };

        buttons[name] = btn;
        buttonWrapper.appendChild(btn);
    });

    let hopIndex = 1;
    let hopInterval = null;
    let isHopping = false;

    const hopToggle = createHopToggle(
        () => {
            if (hopInterval) clearInterval(hopInterval);
            isHopping = true;
            hopInterval = setInterval(() => {
                if (!isHopping) return;

                container.selectAll("svg").remove();
                const predKey = `pred${predCounter}_${hopIndex}`;

                const dataActive = buttons["data"].classList.contains("active-toggle");
                const predActive = buttons["prediction"].classList.contains("active-toggle");

                if (dataActive && predActive) {
                    drawSuperimposedScatterPlot(container.node(), featureX, featureY, predKey, featureX_Name, predictedFeature.name, dataSubset);
                } else if (predActive) {
                    drawScatterPlot(container.node(), featureX, predKey, featureX_Name, features.find(f => f.key === predKey)?.name || "Predicted", dataSubset, location);
                }

                hopIndex = hopIndex === 5 ? 1 : hopIndex + 1;
            }, 500);
        },
        () => {
            console.log("Toggle OFF — clearing interval");
            isHopping = false;
            clearInterval(hopInterval);
            hopInterval = null;
            hopIndex = 1;
        }
    );

    hopToggle.style.display = "none";
    buttonWrapper.appendChild(hopToggle);

    container.node().appendChild(buttonWrapper);

    }

    drawScatterPlot(container.node(), featureX, featureY, featureX_Name, featureY_Name, dataSubset, baseChart_col, location);

    /*
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
    
    const width = size - margin.left - margin.right;
    const height = size - margin.top - margin.bottom;
        
    const plotId = `${featureX}-${featureY}-${Date.now()}`;

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
    //d3.select(container).selectAll(".scatter-wrapper").remove();

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

    */


    /*

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
    */

    // drop categorical feature
    container
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
                    .style("width", "200px")
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
                    .style("left", "0px")
                    .style("background", "#eee")
                    .style("padding", "2px 6px")
                    .style("font-size", "10px")
                    .style("border-radius", "3px")
                    .text(category);
            });
        });

}

function drawScatterPlot(container, featureX, featureY, xLabel, yLabel, dataSubset, color, location) {
    let size;
    let margin;

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

    const width = size - margin.left - margin.right;
    const height = size - margin.top - margin.bottom;

    const plotId = d3.select(container).attr("data-plot-id");

    const x = d3.scaleLinear()
        .domain(d3.extent(dataSubset, d => +d[featureX])).nice()
        .range([margin.left, size - margin.right]);

    const y = d3.scaleLinear()
        .domain(d3.extent(dataSubset, d => +d[featureY])).nice()
        .range([size - margin.bottom, margin.top]);

    const svg = d3.select(container)
        .append("svg")
        .attr("width", size)
        .attr("height", size)
        .attr("class", "scatter-plot");

    // Create a group for the points
    const pointsGroup = svg.append("g")
        .attr("class", "points-group");

    //svg.append("g")
    pointsGroup
        .selectAll("circle")
        .data(dataSubset)
        .enter()
        .append("circle")
        .attr("class", "scatter-point")
        .attr("cx", d => x(d[featureX]))
        .attr("cy", d => y(d[featureY]))
        .attr("r", location === "table" ? 1 : 3)
        .attr("fill", color)
        .attr("opacity", 0.5)
        .attr("data-index", (d, i) => i);   // for brushing and linking

    svg.append("g")
        .attr("transform", `translate(0,${size - margin.bottom})`)
        .call(d3.axisBottom(x).ticks(5).tickSize(3));

    
    svg.append("g")
        .attr("transform", `translate(${margin.left},0)`)
        .call(d3.axisLeft(y).ticks(5).tickSize(3));

    if (location == 'visArea') {
        svg.append("text")
            .attr("text-anchor", "middle")
            .attr("x", width / 2 + margin.left)
            .attr("y", size - 5)
            .text(xLabel);

        svg.append("text")
            .attr("text-anchor", "middle")
            .attr("transform", "rotate(-90)")
            .attr("x", -height / 2)
            .attr("y", 15)
            .text(yLabel);
        
    }
    


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
        console.log(highlightedIndices);
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

        /*
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
        */


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
    
}

function drawSuperimposedScatterPlot(container, featureX, featureY, predictedKey, xLabel, yLabel, dataSubset) {
    const size = 200;
    const margin = { top: 10, right: 10, bottom: 40, left: 40 };
    const width = size - margin.left - margin.right;
    const height = size - margin.top - margin.bottom;

    const allY = dataSubset.map(d => [d[featureY], d[predictedKey]]).flat();
    const x = d3.scaleLinear().domain(d3.extent(dataSubset, d => +d[featureX])).nice().range([margin.left, size - margin.right]);
    const y = d3.scaleLinear().domain(d3.extent(allY)).nice().range([size - margin.bottom, margin.top]);

    const svg = d3.select(container)
        .append("svg")
        .attr("width", size)
        .attr("height", size)
        .attr("class", "scatter-plot");

    // Actual data
    svg.append("g")
        .selectAll("circle.actual")
        .data(dataSubset)
        .enter()
        .append("circle")
        .attr("class", "actual")
        .attr("cx", d => x(d[featureX]))
        .attr("cy", d => y(d[featureY]))
        .attr("r", location === "table" ? 1 : 3)
        .attr("fill", baseChart_col)
        .attr("opacity", 0.6);

    // Prediction
    svg.append("g")
        .selectAll("circle.prediction")
        .data(dataSubset)
        .enter()
        .append("circle")
        .attr("class", "prediction")
        .attr("cx", d => x(d[featureX]))
        .attr("cy", d => y(d[predictedKey]))
        .attr("r", location === "table" ? 1 : 3)
        .attr("fill", predictChart_col)
        .attr("opacity", 0.4);

    svg.append("g")
        .attr("transform", `translate(0,${size - margin.bottom})`)
        .call(d3.axisBottom(x).ticks(5).tickSize(3));

    svg.append("g")
        .attr("transform", `translate(${margin.left},0)`)
        .call(d3.axisLeft(y).ticks(5).tickSize(3));

    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("x", width / 2 + margin.left)
        .attr("y", size - 5)
        .text(xLabel);

    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", 15)
        .text(yLabel);
}