// File: popup.js

// Main class that handles all trading assistant functionality
class TradingAssistant {
    constructor() {
      // List of markets we're tracking - might add more in the future
      this.markets = ['gold', 'oil', 'dj'];
      this.scenarioManager = new ScenarioManager();
      this.scenarioEditor = null;
      // Keeps track of which scenario is assigned to which market
      this.marketAssignments = {};
      this.initializeApp();
    }
  
    async initializeApp() {
        try {
            await this.scenarioManager.loadScenarios();
            this.marketAssignments = await this.scenarioManager.getMarketAssignments();
            this.initializeTimeDisplay();
            this.initializeEventListeners();
            this.renderMarketAssignments();
            this.initializeDarkMode();
            this.initializeFontSize(); // Had to add this after users complained about readability
        } catch (error) {
            console.error('Error initializing app:', error);
        }
    }
    
    // Font size handler - saves preference to localStorage so it persists between sessions
    initializeFontSize() {
        const fontSizeSelect = document.getElementById('fontSizeSelect');
        if (!fontSizeSelect) {
            console.error('Font size selector not found.');
            return;
        }
    
        const savedFontSize = localStorage.getItem('fontSize') || 'medium';
        document.body.classList.add(`font-${savedFontSize}`);
        fontSizeSelect.value = savedFontSize;
    
        fontSizeSelect.addEventListener('change', () => {
            const selectedFontSize = fontSizeSelect.value;
            document.body.classList.remove('font-small', 'font-medium', 'font-large');
            document.body.classList.add(`font-${selectedFontSize}`);
            localStorage.setItem('fontSize', selectedFontSize);
        });
    }
    
    // Dark mode was crucial for night trading sessions
    initializeDarkMode() {
        const darkModeToggle = document.getElementById('darkModeToggle');
        if (!darkModeToggle) {
            console.error('Dark mode toggle not found.');
            return;
        }
    
        const isDarkMode = JSON.parse(localStorage.getItem('darkMode') || 'false');
        document.body.classList.toggle('dark-mode', isDarkMode);
        darkModeToggle.checked = isDarkMode;
    
        darkModeToggle.addEventListener('change', () => {
            const enabled = darkModeToggle.checked;
            document.body.classList.toggle('dark-mode', enabled);
            localStorage.setItem('darkMode', JSON.stringify(enabled));
        });
    }
  
    // Updates time display every second - needed for trade timing
    initializeTimeDisplay() {
      const timeDisplay = document.getElementById('currentTime');
      if (!timeDisplay) {
        console.error('Time display element not found');
        return;
      }
  
      const updateTime = () => {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('pl-PL', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
        timeDisplay.textContent = timeStr;
      };
  
      updateTime();
      setInterval(updateTime, 1000);
    }
  
    // Sets up all event listeners - keep them in one place for easier maintenance
    initializeEventListeners() {
      const predictButton = document.getElementById('predict');
      const saveButton = document.getElementById('save');
      const editScenariosButton = document.getElementById('editScenarios');
      const scenarioModal = document.getElementById('scenarioModal');
  
      if (predictButton) {
        predictButton.addEventListener('click', () => this.generatePrediction());
      }
      if (saveButton) {
        saveButton.addEventListener('click', () => this.saveState());
      }
      if (editScenariosButton && scenarioModal) {
        editScenariosButton.addEventListener('click', () => {
          this.openScenarioEditor();
        });
  
        // Modal close handlers
        scenarioModal.querySelector('.close-modal').addEventListener('click', () => {
          scenarioModal.style.display = 'none';
        });
  
        // Close modal when clicking outside - UX improvement
        window.addEventListener('click', (event) => {
          if (event.target === scenarioModal) {
            scenarioModal.style.display = 'none';
          }
        });
      }
    }
  
    // This is where the magic happens - renders all market cards with their scenarios
    renderMarketAssignments() {
        this.markets.forEach((market) => {
            const marketContainer = document.getElementById(`${market}-container`);
            const scenarioSelect = document.getElementById(`${market}-scenario-select`);
            const conditionsContainer = document.getElementById(`${market}-conditions`);
    
            if (!marketContainer || !scenarioSelect || !conditionsContainer) return;
    
            // Populate scenario dropdown
            scenarioSelect.innerHTML = `
                <option value="">Brak przypisania</option>
                ${Object.keys(this.scenarioManager.scenarios)
                    .map((key) => `
                        <option value="${key}" ${this.marketAssignments[market] === key ? "selected" : ""}>
                            ${this.scenarioManager.scenarios[key].name}
                        </option>
                    `)
                    .join('')}
            `;
    
            // Update conditions when scenario changes
            scenarioSelect.addEventListener('change', (event) => {
                const selectedScenario = event.target.value;
                this.assignScenarioToMarket(market, selectedScenario);
            });
    
            const assignedScenario = this.marketAssignments[market];
            this.renderMarketConditions(conditionsContainer, assignedScenario);
        });
    }
    
    // Handles scenario assignment and UI update
    async assignScenarioToMarket(market, scenarioId) {
        try {
          console.log(`Assigning scenario '${scenarioId}' to market '${market}'`);
          await this.scenarioManager.assignScenarioToMarket(market, scenarioId);
          this.marketAssignments[market] = scenarioId;
          this.renderMarketAssignments();
        } catch (error) {
          console.error(`Error assigning scenario to market ${market}:`, error);
        }
    }
      
    // Renders conditions based on scenario type - this was tricky to get right
    renderMarketConditions(container, scenarioId) {
        container.innerHTML = "";
    
        if (!scenarioId || !this.scenarioManager.scenarios[scenarioId]) {
            container.innerHTML = "<p>No scenario assigned.</p>";
            return;
        }
    
        const scenario = this.scenarioManager.scenarios[scenarioId];
        const { conditions } = scenario || {};
    
        if (!conditions || Object.keys(conditions).length === 0) {
            container.innerHTML = "<p>No conditions for this scenario.</p>";
            return;
        }
    
        // Render each condition based on its configuration
        container.innerHTML = Object.keys(conditions)
            .map((conditionKey) => {
                const condition = conditions[conditionKey];
    
                if (!condition) {
                    console.warn(`Skipped condition: ${conditionKey}, missing data.`);
                    return `<p>Unknown condition (${conditionKey})</p>`;
                }
    
                return `
                    <div class="condition-item">
                        <label>${condition.label || "Unknown condition"}:</label>
                        ${this.renderConditionInput(conditionKey, condition, container.id.split('-')[0])}
                    </div>
                `;
            })
            .join('');
    }
    
    // Renders different types of inputs based on condition type
    // This was a pain to debug with radio buttons at first
    renderConditionInput(conditionKey, condition, market) {
        if (!condition || !condition.type) {
            console.warn(`Can't render condition: ${conditionKey}, missing data or unknown type.`);
            return `<p>Unknown condition type (${conditionKey}).</p>`;
        }
    
        const inputName = `${market}-${conditionKey}`;
        const isRequired = condition.required ? 'required' : '';
    
        switch (condition.type) {
            case 'radio':
                return `
                    ${condition.options.map(option => `
                        <label>
                            <input type="radio" name="${inputName}" value="${option.value}" ${isRequired}>
                            ${option.label || 'Unknown option'} (${option.weight || 0})
                        </label>
                    `).join('')}
                `;
    
            case 'checkbox':
                return `
                    <input type="checkbox" id="${inputName}" ${isRequired}>
                    ${condition.label || 'Option'} (${condition.weight || 0})
                `;
    
            case 'select':
                return `
                    <select id="${inputName}" ${isRequired}>
                        ${(condition.options || []).map(option => `
                            <option value="${option.value}">
                                ${option.label || 'Unknown option'} (${option.weight || 0})
                            </option>
                        `).join('')}
                    </select>
                `;
    
            case 'text':
                return `
                    <input type="text" id="${inputName}" 
                           value="${condition.value || ''}" 
                           placeholder="${condition.description || 'Enter value...'}" ${isRequired}>
                `;
    
            default:
                console.warn(`Unknown condition type: ${condition.type}`);
                return `<p>Unknown condition type (${condition.type}).</p>`;
        }
    }
    
    // Legacy method for changing scenarios via prompt - keeping it as a backup
    async changeMarketScenario(market) {
      try {
        const scenarioKeys = Object.keys(this.scenarioManager.scenarios);
        if (!scenarioKeys.length) {
          alert('No scenarios available to assign!');
          return;
        }
  
        const scenarioOptions = scenarioKeys
          .map((key) => `${key}: ${this.scenarioManager.scenarios[key].name || 'Unnamed'}`)
          .join('\n');
  
        const selectedScenario = prompt(
          `Choose scenario for ${market.toUpperCase()}:\n${scenarioOptions}`
        );
  
        if (selectedScenario && this.scenarioManager.scenarios[selectedScenario]) {
          await this.scenarioManager.assignScenarioToMarket(market, selectedScenario);
          this.marketAssignments[market] = selectedScenario;
          this.renderMarketAssignments();
          alert(`Scenario "${this.scenarioManager.scenarios[selectedScenario].name}" assigned to ${market.toUpperCase()}.`);
        } else {
          alert('Invalid scenario selection.');
        }
      } catch (error) {
        console.error('Error assigning scenario:', error);
      }
    }
  
    // Main prediction generator - processes all markets and their conditions
    generatePrediction() {
        const predictionElement = this.getElement('prediction');
        if (!predictionElement) {
            console.error('Prediction element not found.');
            return;
        }
    
        let predictions = '';
        this.markets.forEach((market) => {
            try {
                // Get assigned conditions and scenario
                const conditions = this.getMarketConditions(market);
                const assignedScenario = this.marketAssignments[market];
    
                if (assignedScenario) {
                    // Generate prediction if scenario is assigned
                    predictions += this.generateMarketPrediction(market, conditions, assignedScenario);
                } else {
                    predictions += this.formatPrediction(
                        market,
                        'neutral',
                        'No scenario assigned'
                    );
                }
            } catch (error) {
                console.error(`Error generating prediction for ${market}:`, error);
                predictions += this.formatPrediction(
                    market,
                    'error',
                    'Error analyzing conditions'
                );
            }
        });
    
        predictionElement.innerHTML = predictions;
    }
    
    // Generates prediction for a single market based on its conditions
    generateMarketPrediction(market, conditions, scenarioId) {
        if (!conditions) {
          console.error(`Error: no conditions for market ${market}`);
          return this.formatPrediction(market, 'error', 'Analysis error');
        }
      
        try {
          const prediction = this.scenarioManager.evaluateScenario(scenarioId, conditions.conditions);
          console.debug(`Result for market ${market}:`, prediction);
          return this.formatPrediction(
            market,
            prediction.type,
            `${prediction.message}${prediction.score ? ` (Strength: ${prediction.score})` : ''}`
          );
        } catch (error) {
          console.error(`Scenario evaluation error for market ${market}:`, error);
          return this.formatPrediction(market, 'error', 'Scenario error');
        }
    }
      
    // Helper to format prediction output with consistent styling
    formatPrediction(market, type, message) {
      return `<div class="prediction ${type}">${market.toUpperCase()}: ${message}</div>`;
    }
  
    // Utility method to get DOM elements - helps catch missing elements early
    getElement(id) {
      return document.getElementById(id);
    }
  
    // Helper for radio button groups - returns selected radio or null
    getCheckedRadio(name) {
      return document.querySelector(`input[name="${name}"]:checked`);
    }
  
    // Collects all conditions for a market - this is where we gather user input
    getMarketConditions(market) {
        try {
            // Get assigned scenario
            const assignedScenarioId = this.marketAssignments[market];
            if (!assignedScenarioId || !this.scenarioManager.scenarios[assignedScenarioId]) {
                console.error(`No scenario assigned or scenario doesn't exist for market: ${market}`);
                return null;
            }
    
            const scenario = this.scenarioManager.scenarios[assignedScenarioId];
            const conditions = scenario.conditions || {};
    
            console.log(`Collecting conditions for market: ${market}`);
            console.log(`Assigned scenario: ${assignedScenarioId}`);
            console.log(`Defined scenario conditions:`, conditions);
    
            const collectedConditions = {};
            Object.keys(conditions).forEach((conditionKey) => {
                const condition = conditions[conditionKey];
                if (!condition) {
                    console.warn(`Missing configuration for condition: ${conditionKey}`);
                    return;
                }
    
                let value;
                try {
                    // Handle different input types - each needs its own logic
                    switch (condition.type) {
                        case 'radio': {
                            const selectedRadio = this.getCheckedRadio(`${market}-${conditionKey}`);
                            value = selectedRadio ? selectedRadio.value : null;
                            break;
                        }
                        case 'checkbox': {
                            const checkboxElement = this.getElement(`${market}-${conditionKey}`);
                            value = checkboxElement ? checkboxElement.checked : false;
                            break;
                        }
                        case 'text': {
                            const textElement = this.getElement(`${market}-${conditionKey}`);
                            value = textElement ? textElement.value.trim() : null;
                            break;
                        }
                        case 'select': {
                            const selectElement = this.getElement(`${market}-${conditionKey}`);
                            value = selectElement ? selectElement.value : null;
                            break;
                        }
                        default: {
                            console.warn(`Unknown condition type: '${condition.type}' for key '${conditionKey}'.`);
                            value = null;
                        }
                    }
    
                    // Debug value before saving
                    if (value === null || value === undefined) {
                        console.warn(`Condition '${conditionKey}' has missing value.`);
                    }
    
                    collectedConditions[conditionKey] = {
                        label: condition.label || 'Unknown condition',
                        type: condition.type,
                        value: value,
                        weight: condition.weight || 0,
                    };
                    console.debug(`Collected data for '${conditionKey}':`, collectedConditions[conditionKey]);
                } catch (error) {
                    console.error(`Error processing condition '${conditionKey}' for market '${market}':`, error);
                }
            });
    
            console.log(`Collected conditions for market ${market}:`, collectedConditions);
    
            return {
                market: market,
                conditions: collectedConditions,
            };
        } catch (error) {
            console.error(`Error getting market conditions for ${market}:`, error);
            return null;
        }
    }
   
    // Saves current state of all markets and their conditions
    async saveState() {
      try {
        const state = {};
        this.markets.forEach((market) => {
          const conditions = this.getMarketConditions(market);
          if (conditions) {
            state[market] = conditions;
          }
        });
  
        if (Object.keys(state).length === 0) {
          throw new Error('No valid market conditions to save');
        }
  
        await this.scenarioManager.saveScenarios(); // Save scenarios
        console.debug('State saved:', state);
      } catch (error) {
        console.error('Error saving state:', error);
      }
    }
    
    // Opens the scenario editor modal and initializes it if needed
    openScenarioEditor() {
      const scenarioModal = document.getElementById('scenarioModal');
      if (!scenarioModal) {
        console.error('Modal element for scenario editor not found');
        return;
      }
  
      scenarioModal.style.display = 'block';
  
      // Initialize scenario editor if it doesn't exist
      if (!this.scenarioEditor) {
        const scenarioEditorContainer = document.getElementById('scenarioEditor');
        if (!scenarioEditorContainer) {
          console.error('Container element for scenario editor not found');
          return;
        }
  
        this.scenarioEditor = new ScenarioEditor(scenarioEditorContainer, this.scenarioManager);
        this.scenarioEditor.loadScenarios(); // Load and display scenarios
      } else {
        this.scenarioEditor.render(); // Refresh view
      }
    }
  }
  
  
  
  // Initialize the app when DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    new TradingAssistant();
  });
  
  
  