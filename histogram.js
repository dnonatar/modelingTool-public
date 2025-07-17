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

    /*
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
        
    */

    if (location == 'visArea') {

        /*

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

        */
        
        // Add remove button
        addRemoveButton(container);

        // Create button wrapper ABOVE the chart
        const buttonWrapper = document.createElement("div");
        buttonWrapper.style.position = "absolute";
        buttonWrapper.style.top = "-15px";
        buttonWrapper.style.left = "50px";
        buttonWrapper.style.display = "flex";
        buttonWrapper.style.gap = "5px";
        buttonWrapper.style.zIndex = "20";

        // Create buttons
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

            // Default "data" as selected
            if (name === "data") {
                btn.classList.add("active-toggle");
                btn.style.background = "rgba(105, 179, 162, 0.4)";
                btn.style.fontWeight = "bold";
            }

            btn.onclick = () => {
                const isActive = btn.classList.contains("active-toggle");
                btn.classList.toggle("active-toggle");
                //btn.style.background = isActive ? "#f4f4f4" : "#d0eaff";
                if (name === "data") {
                    btn.style.background = isActive ? "#f4f4f4" : "rgba(105, 179, 162, 0.4)";  
                } else {
                    btn.style.background = isActive ? "#f4f4f4" : "rgba(0, 150, 255, 0.3)";  
                }
                btn.style.fontWeight = isActive ? "normal" : "bold";

                // Re-render overlay logic
                container.selectAll("svg").remove(); 

                const dataActive = buttons["data"].classList.contains("active-toggle");
                const predActive = buttons["prediction"].classList.contains("active-toggle");

                // Show toggle only when prediction is active
                hopToggle.style.display = predActive ? "flex" : "none";

                if (dataActive && predActive) {
                    drawSuperimposedHistogram(container.node(), featureKey, "pred" + predCounter + "_1", dataSubset);
                } else if (dataActive) {
                    drawHistogram(container.node(), featureKey, featureName, baseChart_col, dataSubset, location);
                } else if (predActive) {
                    drawHistogram(container.node(), "pred" + predCounter + "_1", "Predicted " + featureName, predictChart_col, dataSubset, location);
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
                        drawSuperimposedHistogram(container.node(), featureKey, predKey, dataSubset);
                    } else if (predActive) {
                        drawHistogram(container.node(), predKey, "Predicted " + featureName, predictChart_col, dataSubset, location);
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

        // Draw initial chart (data only)
        drawHistogram(container.node(), featureKey, featureName, baseChart_col, dataSubset, location);

    } if (location == 'table') {
        drawHistogram(container.node(), featureKey, featureName, baseChart_col, dataSubset, location);
    }
    
}

function drawHistogram(container, key, label, color, dataSubset, location) {
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

    const mappedData = dataSubset.map((d, i) => ({
        value: +d[key],
        index: i
    }));

    const x = d3.scaleLinear()
        .domain(d3.extent(mappedData, d => d.value)).nice()
        .range([margin.left, size - margin.right]);

    const bins = d3.histogram()
        .domain(x.domain())
        .thresholds(10)
        .value(d => d.value)(mappedData);

    const y = d3.scaleLinear()
        .domain([0, d3.max(bins, d => d.length)]).nice()
        .range([size - margin.bottom, margin.top]);

    const svg = d3.select(container)
        .append("svg")
        .attr("width", size)
        .attr("height", size)
        .attr("class", "distribution-plot");

    svg.append("g")
        .selectAll("rect")
        .data(bins)
        .enter()
        .append("rect")
        .attr("x", d => x(d.x0) + 1)
        .attr("y", d => y(d.length))
        .attr("width", d => x(d.x1) - x(d.x0) - 1)
        .attr("height", d => y(0) - y(d.length))
        .attr("fill", color)
        .attr("opacity", 0.6);

    if (location == 'visArea') {

        svg.append("g")
            .attr("transform", `translate(0,${size - margin.bottom})`)
            .call(d3.axisBottom(x).tickSize(3).ticks(5));

        svg.append("g")
            .attr("transform", `translate(${margin.left},0)`)
            .call(d3.axisLeft(y).tickSize(3).ticks(5));

        svg.append("text")
            .attr("text-anchor", "middle")
            .attr("x", width / 2 + margin.left)
            .attr("y", size - 5)
            .text(label);

        svg.append("text")
            .attr("text-anchor", "middle")
            .attr("transform", "rotate(-90)")
            .attr("x", -height / 2)
            .attr("y", 15)
            .text("Frequency");

    } else if (location == 'table') {
        svg.append("g")
            .attr("transform", `translate(0,${size - margin.bottom})`)
            .call(d3.axisBottom(x).tickSize(1).ticks(2));
    }
}

function drawSuperimposedHistogram(container, key1, key2, dataSubset) {
    const label = features.find(f => f.key === key1)?.name;

    const size = 200;
    const margin = { top: 10, right: 10, bottom: 40, left: 40 };
    const width = size - margin.left - margin.right;
    const height = size - margin.top - margin.bottom;

    const mapped1 = dataSubset.map((d, i) => ({ value: +d[key1], index: i }));
    const mapped2 = dataSubset.map((d, i) => ({ value: +d[key2], index: i }));

    const allValues = [...mapped1.map(d => d.value), ...mapped2.map(d => d.value)];
    const x = d3.scaleLinear().domain(d3.extent(allValues)).nice().range([margin.left, size - margin.right]);

    const bins1 = d3.histogram().domain(x.domain()).thresholds(10).value(d => d.value)(mapped1);
    const bins2 = d3.histogram().domain(x.domain()).thresholds(10).value(d => d.value)(mapped2);

    const maxY = Math.max(d3.max(bins1, d => d.length), d3.max(bins2, d => d.length));
    const y = d3.scaleLinear().domain([0, maxY]).range([size - margin.bottom, margin.top]);

    const svg = d3.select(container)
        .append("svg")
        .attr("width", size)
        .attr("height", size)
        .attr("class", "distribution-plot");

    svg.append("g")
        .selectAll("rect.data-bar")
        .data(bins1)
        .enter()
        .append("rect")
        .attr("class", "data-bar")
        .attr("x", d => x(d.x0) + 1)
        .attr("y", d => y(d.length))
        .attr("width", d => x(d.x1) - x(d.x0) - 1)
        .attr("height", d => y(0) - y(d.length))
        .attr("fill", baseChart_col)
        .attr("opacity", 0.5);

    svg.append("g")
        .selectAll("rect.pred-bar")
        .data(bins2)
        .enter()
        .append("rect")
        .attr("class", "pred-bar")
        .attr("x", d => x(d.x0) + 1)
        .attr("y", d => y(d.length))
        .attr("width", d => x(d.x1) - x(d.x0) - 1)
        .attr("height", d => y(0) - y(d.length))
        .attr("fill", predictChart_col)
        .attr("opacity", 0.5);

    svg.append("g")
        .attr("transform", `translate(0,${size - margin.bottom})`)
        .call(d3.axisBottom(x).tickSize(3).ticks(5));

    svg.append("g")
        .attr("transform", `translate(${margin.left},0)`)
        .call(d3.axisLeft(y).tickSize(3).ticks(5));

    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("x", width / 2 + margin.left)
        .attr("y", size - 5)
        .text(label);

    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", 15)
        .text("Frequency");
}