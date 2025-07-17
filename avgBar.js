


function renderAverageBarChart(container, categoricalFeature, continuousFeature, cateName, contName, dataSubset = dataset) {
    addRemoveButton(d3.select(container));
    d3.select(container).style("position", "relative");

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

            container.querySelector("svg")?.remove();
            drawSideBySideAvgBars(container, categoricalFeature, continuousFeature, cateName, contName, buttons, dataSubset);
        };

        buttons[name] = btn;
        buttonWrapper.appendChild(btn);
    });

    container.appendChild(buttonWrapper);

    drawSideBySideAvgBars(container, categoricalFeature, continuousFeature, cateName, contName, buttons, dataSubset);
}



function drawSideBySideAvgBars(container, categoricalFeature, continuousFeature, cateName, contName, buttons, dataSubset) {
    const size = 200;
    const margin = { top: 10, right: 10, bottom: 40, left: 40 };
    const width = size - margin.left - margin.right;
    const height = size - margin.top - margin.bottom;

    const showData = buttons["data"]?.classList.contains("active-toggle");
    const showPrediction = buttons["prediction"]?.classList.contains("active-toggle");

    if (!showData && !showPrediction) return;

    const grouped = d3.rollups(
        dataSubset,
        v => {
            const n = v.length;
            const mean = d3.mean(v, d => +d[continuousFeature]);
            const std = d3.deviation(v, d => +d[continuousFeature]);
            const se = std / Math.sqrt(n);
            const margin = 1.96 * se;
            return { mean, lower: mean - margin, upper: mean + margin };
        },
        d => d[categoricalFeature]
    ).map(([category, stats]) => ({ category, ...stats }));

    const predKey = `pred${predCounter}_1`;

    const barData = grouped.flatMap(d => {
        const entries = [];
        if (showData) {
            entries.push({ category: d.category, type: "data", mean: d.mean, color: baseChart_col });
        }
        if (showPrediction) {
            const predVals = dataSubset.filter(r => r[categoricalFeature] === d.category).map(r => +r[predKey]);
            const mean = d3.mean(predVals);
            const std = d3.deviation(predVals);
            const se = std / Math.sqrt(predVals.length);
            const margin = 1.96 * se;
            entries.push({ category: d.category, type: "prediction", mean, color: predictChart_col });
        }
        return entries;
    });

    const x0 = d3.scaleBand()
        .domain(grouped.map(d => d.category))
        .range([margin.left, width + margin.left])
        .padding(0.1);

    const x1 = d3.scaleBand()
        .domain(["data", "prediction"])
        .range([0, x0.bandwidth()])
        .padding(0.05);

    const y = d3.scaleLinear()
        .domain([0, d3.max(barData, d => d.mean)])
        .nice()
        .range([height + margin.top, margin.top]);

    const svg = d3.select(container).append("svg")
        .attr("width", size)
        .attr("height", size);

    svg.selectAll("g.category-group")
        .data(d3.groups(barData, d => d.category))
        .enter()
        .append("g")
        .attr("class", "category-group")
        .attr("transform", d => `translate(${x0(d[0])},0)`)
        .selectAll("rect")
        .data(d => d[1])
        .enter()
        .append("rect")
        .attr("x", d => x1(d.type))
        .attr("y", d => y(d.mean))
        .attr("width", x1.bandwidth())
        .attr("height", d => y(0) - y(d.mean))
        .attr("fill", d => d.color)
        .attr("opacity", 0.7);

    svg.append("g")
        .attr("transform", `translate(0,${y(0)})`)
        .call(d3.axisBottom(x0).tickSize(3));

    svg.append("g")
        .attr("transform", `translate(${margin.left},0)`)
        .call(d3.axisLeft(y).tickSize(2));

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