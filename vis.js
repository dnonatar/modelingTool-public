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
        .style("width", "200px")
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
        .style("width", "200px")
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
