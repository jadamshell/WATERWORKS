// Chart management and visualization
export class ChartManager {
  constructor() {
    this.charts = {};
    this.trackedNodes = [
      "J-1-37", "J-1-38", "J-1-58",
      "J-5-15", "J-5-12", "J-5-13", 
      "J-6", "J-6-65", "J-9-5",
      "J-8-8", "J-10-3"
    ];
    
    // Threshold values for compliance monitoring
    this.thresholds = {
      pressure: { low: 20, high: 150 },
      quality: { low: 0.2, high: 4.0 },
      tank: { min: 39, max: 73.88 }
    };
    
    // Statistics tracking
    this.complianceTracking = { pressure: {}, quality: {}, tank: {} };
    this.statsTracking = { head: {}, pressure: {}, demand: {}, quality: {}, tank: {} };
    
    // Chart animation settings
    this.delayBetweenPoints = 5000 / 168; // Animation timing
    this.setupChartAnimations();
    this.setupThresholdPlugin();
    
    this.initializeTracking();
  }

  initializeTracking() {
    // Initialize tracking objects for each node
    this.trackedNodes.forEach(node => {
      this.complianceTracking.pressure[node] = { lowCount: 0, highCount: 0, totalPoints: 0 };
      this.complianceTracking.quality[node] = { lowCount: 0, highCount: 0, totalPoints: 0 };
      
      this.statsTracking.head[node] = { values: [] };
      this.statsTracking.pressure[node] = { values: [] };
      this.statsTracking.demand[node] = { values: [] };
      this.statsTracking.quality[node] = { values: [] };
    });
    
    // Tank tracking
    this.complianceTracking.tank["T-1"] = { lowCount: 0, highCount: 0, totalPoints: 0 };
    this.statsTracking.tank["T-1"] = { values: [] };
  }

  setupChartAnimations() {
    const previousY = (ctx) =>
      ctx.index === 0
        ? ctx.chart.scales.y.getPixelForValue(100)
        : ctx.chart.getDatasetMeta(ctx.datasetIndex).data[ctx.index - 1].getProps(['y'], true).y;

    this.progressiveAnimation = {
      x: {
        type: "number",
        easing: "linear",
        duration: this.delayBetweenPoints,
        from: NaN,
        delay(ctx) {
          if (ctx.type !== "data" || ctx.xStarted) return 0;
          ctx.xStarted = true;
          return ctx.index * this.delayBetweenPoints;
        }
      },
      y: {
        type: "number",
        easing: "linear",
        duration: this.delayBetweenPoints,
        from: previousY,
        delay(ctx) {
          if (ctx.type !== "data" || ctx.yStarted) return 0;
          ctx.yStarted = true;
          return ctx.index * this.delayBetweenPoints;
        }
      }
    };
  }

  setupThresholdPlugin() {
    this.thresholdPlugin = {
      id: 'thresholdLines',
      beforeDraw: (chart) => {
        const { ctx, chartArea: { top, bottom, left, right }, scales: { x, y } } = chart;
        
        const chartTitle = chart.options.plugins.title.text;
        let referenceLines = [];
        
        if (chartTitle.includes("Pressure")) {
          referenceLines = [
            { value: this.thresholds.pressure.low, label: 'Low Pressure (20 psi)', color: 'red' },
            { value: this.thresholds.pressure.high, label: 'High Pressure (150 psi)', color: 'red' }
          ];
        } else if (chartTitle.includes("Quality")) {
          referenceLines = [
            { value: this.thresholds.quality.low, label: 'Low Chlorine (0.2 mg/L)', color: 'red' },
            { value: this.thresholds.quality.high, label: 'High Chlorine (4.0 mg/L)', color: 'red' }
          ];
        } else if (chartTitle.includes("Tank Level")) {
          referenceLines = [
            { value: this.thresholds.tank.min, label: 'Min Level (39 ft)', color: 'red' },
            { value: this.thresholds.tank.max, label: 'Max Level (73.88 ft)', color: 'red' }
          ];
        }
        
        if (referenceLines.length > 0) {
          ctx.save();
          
          referenceLines.forEach(line => {
            const yPosition = y.getPixelForValue(line.value);
            
            if (yPosition < top || yPosition > bottom) return;
            
            ctx.beginPath();
            ctx.moveTo(left, yPosition);
            ctx.lineTo(right, yPosition);
            ctx.lineWidth = 1;
            ctx.strokeStyle = line.color;
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.setLineDash([]);
            
            ctx.fillStyle = line.color;
            ctx.textAlign = 'right';
            ctx.textBaseline = 'bottom';
            ctx.fillText(line.label, right - 5, yPosition - 2);
          });
          
          ctx.restore();
        }
      }
    };
  }

  createChart(ctx, chartLabel, borderColor) {
    let plugins = [];
    if (chartLabel.includes("Pressure") || chartLabel.includes("Quality") || chartLabel.includes("Tank Level")) {
      plugins.push(this.thresholdPlugin);
    }
    
    return new Chart(ctx, {
      type: "line",
      data: { 
        labels: [], 
        datasets: [{ 
          label: chartLabel, 
          data: [], 
          borderColor: borderColor, 
          fill: false, 
          borderWidth: 1, 
          pointStyle: "circle", 
          pointRadius: 1, 
          pointHoverRadius: 3.5 
        }] 
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: this.progressiveAnimation,
        plugins: { 
          title: { display: true, text: chartLabel }
        },
        scales: { 
          x: { title: { display: true, text: "Time (hours)" } },
          y: { title: { display: true, text: chartLabel.split(" ")[0] } } 
        }
      },
      plugins: plugins
    });
  }

  setupCharts() {
    console.log('Setting up charts...');
    
    // Reset tracking for new simulation
    this.initializeTracking();
    
    // Clear existing chart containers
    this.clearDashboards();
    
    // Setup charts for each tracked node
    this.trackedNodes.forEach(node => {
      this.charts[node] = {};
      this.setupNodeCharts(node);
    });
    
    // Setup tank chart
    this.setupTankChart();
    
    console.log('Charts setup complete');
  }

  clearDashboards() {
    document.getElementById('headDashboard').innerHTML = '';
    document.getElementById('pressureDashboard').innerHTML = '';
    document.getElementById('demandDashboard').innerHTML = '';
    document.getElementById('qualityDashboard').innerHTML = '';
    document.getElementById('tankDashboard').innerHTML = '';
  }

  setupNodeCharts(node) {
    // Head chart
    const headContainer = this.createChartContainer(node, 'Head');
    this.charts[node].headChart = this.createChart(
      headContainer.querySelector('canvas'), 
      'Head (ft)', 
      'blue'
    );
    this.charts[node].headStatsDiv = this.createBasicStats(headContainer, 'head', node);
    document.getElementById('headDashboard').appendChild(headContainer);

    // Pressure chart
    const pressureContainer = this.createChartContainer(node, 'Pressure');
    this.charts[node].pressureChart = this.createChart(
      pressureContainer.querySelector('canvas'), 
      'Pressure (psi)', 
      'red'
    );
    this.charts[node].pressureStatsDiv = this.createComplianceStats(pressureContainer, 'pressure', node);
    this.charts[node].pressureBasicStatsDiv = this.createBasicStats(pressureContainer, 'pressure', node);
    document.getElementById('pressureDashboard').appendChild(pressureContainer);

    // Demand chart
    const demandContainer = this.createChartContainer(node, 'Demand');
    this.charts[node].demandChart = this.createChart(
      demandContainer.querySelector('canvas'), 
      'Demand (gpm)', 
      'green'
    );
    this.charts[node].demandStatsDiv = this.createBasicStats(demandContainer, 'demand', node);
    document.getElementById('demandDashboard').appendChild(demandContainer);

    // Quality chart
    const qualityContainer = this.createChartContainer(node, 'Quality');
    this.charts[node].qualityChart = this.createChart(
      qualityContainer.querySelector('canvas'), 
      'Quality (mg/L)', 
      'purple'
    );
    this.charts[node].qualityStatsDiv = this.createComplianceStats(qualityContainer, 'quality', node);
    this.charts[node].qualityBasicStatsDiv = this.createBasicStats(qualityContainer, 'quality', node);
    document.getElementById('qualityDashboard').appendChild(qualityContainer);
  }

  setupTankChart() {
    this.charts["T-1"] = {};
    const tankContainer = this.createChartContainer("T-1", "Tank Level");
    this.charts["T-1"].tankChart = this.createChart(
      tankContainer.querySelector('canvas'), 
      'Tank Level (ft)', 
      'orange'
    );
    this.charts["T-1"].tankStatsDiv = this.createComplianceStats(tankContainer, 'tank', 'T-1');
    this.charts["T-1"].tankBasicStatsDiv = this.createBasicStats(tankContainer, 'tank', 'T-1');
    document.getElementById('tankDashboard').appendChild(tankContainer);
  }

  createChartContainer(nodeId, type) {
    const container = document.createElement('div');
    container.className = 'node-container';
    container.setAttribute('data-node', nodeId);
    container.innerHTML = `
      <h3>${type === 'Tank Level' ? 'Tank T-1 Level (ft)' : `Node: ${nodeId}`}</h3>
      <div class="chart-wrapper">
        <canvas></canvas>
      </div>
    `;
    return container;
  }

  createComplianceStats(container, type, nodeId) {
    const statsDiv = document.createElement('div');
    statsDiv.className = 'compliance-stats';
    statsDiv.innerHTML = `
      <div class="stat-row">
        <span>Low threshold violations:</span>
        <span class="low-flag">0 hours</span>
      </div>
      <div class="stat-row">
        <span>High threshold violations:</span>
        <span class="high-flag">0 hours</span>
      </div>
      <div class="stat-row">
        <span>In compliance:</span>
        <span class="in-compliance">0%</span>
      </div>
      <div class="stat-row">
        <span>Out of compliance:</span>
        <span class="out-of-compliance">0%</span>
      </div>
    `;
    container.appendChild(statsDiv);
    return statsDiv;
  }

  createBasicStats(container, type, nodeId) {
    const statsDiv = document.createElement('div');
    statsDiv.className = 'basic-stats';
    statsDiv.innerHTML = `
      <h4>Simulation Statistics</h4>
      <div class="stat-row">
        <span>Average:</span>
        <span class="stat-value stat-avg">0.00</span>
      </div>
      <div class="stat-row">
        <span>Median:</span>
        <span class="stat-value stat-median">0.00</span>
      </div>
      <div class="stat-row">
        <span>Standard Deviation:</span>
        <span class="stat-value stat-stddev">0.00</span>
      </div>
    `;
    container.appendChild(statsDiv);
    return statsDiv;
  }

  updateCharts(data) {
    if (data.type === 'hydraulic') {
      this.updateHydraulicCharts(data);
    } else if (data.type === 'quality') {
      this.updateQualityCharts(data);
    }
  }

  updateHydraulicCharts(data) {
    // Update charts for each tracked node
    this.trackedNodes.forEach(nodeId => {
      if (data.nodes[nodeId]) {
        const nodeData = data.nodes[nodeId];
        
        // Store values for statistics
        this.statsTracking.head[nodeId].values.push(nodeData.head);
        this.statsTracking.pressure[nodeId].values.push(nodeData.pressure);
        this.statsTracking.demand[nodeId].values.push(nodeData.demand);
        
        // Update charts
        this.updateChart(this.charts[nodeId].headChart, data.time, nodeData.head);
        this.updateChart(this.charts[nodeId].pressureChart, data.time, nodeData.pressure);
        this.updateChart(this.charts[nodeId].demandChart, data.time, nodeData.demand);
        
        // Track pressure compliance
        this.trackCompliance('pressure', nodeId, nodeData.pressure);
        
        // Update statistics displays
        this.updateStatsDisplays(nodeId);
      }
    });
    
    // Update tank chart
    if (data.tank["T-1"]) {
      const tankData = data.tank["T-1"];
      this.statsTracking.tank["T-1"].values.push(tankData.level);
      this.updateChart(this.charts["T-1"].tankChart, data.time, tankData.level);
      this.trackCompliance('tank', 'T-1', tankData.level);
      this.updateTankStats();
    }
  }

  updateQualityCharts(data) {
    this.trackedNodes.forEach(nodeId => {
      if (data.nodes[nodeId]) {
        const nodeData = data.nodes[nodeId];
        
        // Store values for statistics
        this.statsTracking.quality[nodeId].values.push(nodeData.quality);
        
        // Update quality chart
        this.updateChart(this.charts[nodeId].qualityChart, data.time, nodeData.quality);
        
        // Track quality compliance
        this.trackCompliance('quality', nodeId, nodeData.quality);
        
        // Update quality statistics
        this.updateQualityStats(nodeId);
      }
    });
  }

  updateChart(chart, time, value) {
    chart.data.labels.push(time);
    chart.data.datasets[0].data.push(value);
    chart.update('none'); // No animation for real-time updates
  }

  trackCompliance(type, nodeId, value) {
    const tracking = this.complianceTracking[type][nodeId];
    tracking.totalPoints++;
    
    if (type === 'pressure') {
      if (value < this.thresholds.pressure.low) {
        tracking.lowCount++;
      } else if (value > this.thresholds.pressure.high) {
        tracking.highCount++;
      }
    } else if (type === 'quality') {
      if (value < this.thresholds.quality.low) {
        tracking.lowCount++;
      } else if (value > this.thresholds.quality.high) {
        tracking.highCount++;
      }
    } else if (type === 'tank') {
      if (value < this.thresholds.tank.min) {
        tracking.lowCount++;
      } else if (value > this.thresholds.tank.max) {
        tracking.highCount++;
      }
    }
  }

  updateStatsDisplays(nodeId) {
    // Update pressure compliance stats
    this.updateComplianceStats(this.charts[nodeId].pressureStatsDiv, 'pressure', nodeId);
    
    // Update basic stats
    this.updateBasicStats(this.charts[nodeId].headStatsDiv, 'head', nodeId);
    this.updateBasicStats(this.charts[nodeId].pressureBasicStatsDiv, 'pressure', nodeId);
    this.updateBasicStats(this.charts[nodeId].demandStatsDiv, 'demand', nodeId);
  }

  updateQualityStats(nodeId) {
    this.updateComplianceStats(this.charts[nodeId].qualityStatsDiv, 'quality', nodeId);
    this.updateBasicStats(this.charts[nodeId].qualityBasicStatsDiv, 'quality', nodeId);
  }

  updateTankStats() {
    this.updateComplianceStats(this.charts["T-1"].tankStatsDiv, 'tank', 'T-1');
    this.updateBasicStats(this.charts["T-1"].tankBasicStatsDiv, 'tank', 'T-1');
  }

  updateComplianceStats(statsDiv, type, nodeId) {
    const trackingData = this.complianceTracking[type][nodeId];
    const lowCount = trackingData.lowCount;
    const highCount = trackingData.highCount;
    const totalCount = trackingData.totalPoints;
    const totalViolations = lowCount + highCount;
    
    const inCompliancePercent = totalCount > 0 ? 
      ((totalCount - totalViolations) / totalCount * 100).toFixed(1) : "0.0";
    const outOfCompliancePercent = totalCount > 0 ? 
      (totalViolations / totalCount * 100).toFixed(1) : "0.0";
    
    statsDiv.querySelector('.low-flag').textContent = `${lowCount} hours`;
    statsDiv.querySelector('.high-flag').textContent = `${highCount} hours`;
    statsDiv.querySelector('.in-compliance').textContent = `${inCompliancePercent}%`;
    statsDiv.querySelector('.out-of-compliance').textContent = `${outOfCompliancePercent}%`;
  }

  updateBasicStats(statsDiv, type, nodeId) {
    const values = this.statsTracking[type][nodeId].values;
    const stats = this.calculateStats(values);
    
    let decimalPlaces = 2;
    if (type === 'demand' || type === 'quality') {
      decimalPlaces = 3;
    }
    
    statsDiv.querySelector('.stat-avg').textContent = stats.avg.toFixed(decimalPlaces);
    statsDiv.querySelector('.stat-median').textContent = stats.median.toFixed(decimalPlaces);
    statsDiv.querySelector('.stat-stddev').textContent = stats.stdDev.toFixed(decimalPlaces);
  }

  calculateStats(values) {
    if (!values || values.length === 0) return { avg: 0, median: 0, stdDev: 0 };
    
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 === 0 ? 
      (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    
    const squareDiffs = values.map(value => {
      const diff = value - avg;
      return diff * diff;
    });
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
    const stdDev = Math.sqrt(avgSquareDiff);
    
    return { avg, median, stdDev };
  }

  // Method to handle chart container visibility
  updateNodeVisibility(nodeId, visible) {
    const containers = document.querySelectorAll(`.node-container[data-node="${nodeId}"]`);
    containers.forEach(container => {
      container.style.display = visible ? 'block' : 'none';
    });
    window.dispatchEvent(new Event('resize'));
  }

  // Method to handle tab switching
  switchTab(tabName) {
    const dashboards = {
      'head': document.getElementById('headDashboard'),
      'pressure': document.getElementById('pressureDashboard'),
      'demand': document.getElementById('demandDashboard'),
      'quality': document.getElementById('qualityDashboard'),
      'tank': document.getElementById('tankDashboard')
    };

    // Hide all dashboards
    Object.values(dashboards).forEach(dashboard => {
      dashboard.style.display = 'none';
    });

    // Show selected dashboard
    if (dashboards[tabName]) {
      dashboards[tabName].style.display = 'grid';
    }

    // Trigger resize event for chart responsiveness
    window.dispatchEvent(new Event('resize'));
  }

  // Handle window resize for chart responsiveness
  handleResize() {
    Object.values(this.charts).forEach(nodeCharts => {
      Object.values(nodeCharts).forEach(chart => {
        if (chart && typeof chart.resize === 'function') {
          chart.resize();
        }
      });
    });
  }
}