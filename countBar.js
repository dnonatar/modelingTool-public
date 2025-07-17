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