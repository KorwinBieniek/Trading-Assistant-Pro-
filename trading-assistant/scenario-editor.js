// File: scenario-editor.js

// Main class for managing trading scenarios - handles creation, editing, and saving of scenario configurations
class ScenarioEditor {
    constructor(containerElement, scenarioManager) {
      this.containerElement = containerElement;
      this.scenarioManager = scenarioManager;
      // Keep scenarios in memory to avoid constant reloading
      this.scenarios = {};
    }
  
    // Load scenarios from storage or create default ones if none exist
    async loadScenarios() {
        try {
            const loadedScenarios = await this.scenarioManager.loadScenarios();
            // Only update scenarios if we don't have any - prevents overwriting unsaved changes
            if (!Object.keys(this.scenarios).length) {
                this.scenarios = loadedScenarios;
            }
            this.render();
        } catch (error) {
            console.error("Error loading scenarios:", error);
        }
    }
    
    // Saves scenarios and creates a downloadable backup
    // Added backup feature after a user lost their configs
    saveScenarios() {
        try {
            // First save to local storage
            this.scenarioManager.saveScenarios(this.scenarios)
                .then(() => {
                    // Create a downloadable JSON backup
                    const jsonContent = JSON.stringify({
                        version: "1.0",
                        scenarios: this.scenarios
                    }, null, 2); // Pretty print JSON for readability
    
                    const blob = new Blob([jsonContent], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
    
                    // Trigger download
                    const downloadLink = document.createElement("a");
                    downloadLink.href = url;
                    downloadLink.download = "scenarios.json";
    
                    downloadLink.click();
                    URL.revokeObjectURL(url); // Cleanup

                    alert("Scenarios saved and downloaded successfully!");
                    this.render();
                })
                .catch(error => {
                    console.error("Error saving scenarios:", error);
                    alert("Error saving scenarios.");
                });
        } catch (error) {
            console.error("Unexpected error in saveScenarios:", error);
            alert("Unexpected error saving scenarios.");
        }
    }
    
    // Backend integration for saving scenarios
    // TODO: Implement proper API endpoint handling
    async saveScenariosToFile() {
        try {
            const response = await fetch('/scenarios.json', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ scenarios: this.scenarios }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            console.log('Scenarios saved to scenarios.json');
        } catch (error) {
            console.error('Error saving scenarios to file:', error);
        }
    }
    
    // Renders the main editor interface
    // This was tricky to get right with all the dynamic elements
    render() {
      if (!this.containerElement) return;
  
      const scenarios = this.scenarios || {};
      this.containerElement.innerHTML = `
        <div class="scenario-list">
          <h5>Lista Scenariuszy</h5>
          ${Object.keys(scenarios).map(key => `
            <div class="scenario-item">
              <span>${scenarios[key].name || "Bez nazwy"}</span>
              <button class="edit-scenario" data-scenario="${key}">Edytuj</button>
              <button class="delete-scenario" data-scenario="${key}">Usuń</button>
            </div>
          `).join('')}
          <button id="addScenario" class="add-scenario-button">Dodaj Scenariusz</button>
        </div>
        <div class="scenario-details" id="scenarioDetails">
          <h5>Szczegóły Scenariusza</h5>
          <div id="scenarioEditorForm"></div>
        </div>
      `;
  
      this.initializeEventListeners();
    }
  
    // Sets up all the event handlers for the editor interface
    initializeEventListeners() {
      const addScenarioButton = this.containerElement.querySelector('#addScenario');
      const editButtons = this.containerElement.querySelectorAll('.edit-scenario');
      const deleteButtons = this.containerElement.querySelectorAll('.delete-scenario');
  
      if (addScenarioButton) {
        addScenarioButton.addEventListener('click', () => this.addScenario());
      }
  
      editButtons.forEach(button => {
        button.addEventListener('click', (event) => {
          const scenarioKey = event.target.dataset.scenario;
          this.editScenario(scenarioKey);
        });
      });
  
      deleteButtons.forEach(button => {
        button.addEventListener('click', (event) => {
          const scenarioKey = event.target.dataset.scenario;
          this.deleteScenario(scenarioKey);
        });
      });
    }
  
    // Creates a new scenario with unique timestamp ID
    addScenario() {
      const newScenarioKey = `scenario_${Date.now()}`;
      this.scenarios[newScenarioKey] = {
        name: "Nowy Scenariusz",
        conditions: {},
        outputs: {},
      };
      this.render();
    }
  
    // Renders the scenario editing form
    // This is the heart of the editor - handles all the complex condition types
    editScenario(key) {
        const scenario = this.scenarios[key];
        const formContainer = this.containerElement.querySelector('#scenarioEditorForm');
    
        if (!formContainer) return;
    
        // Build the form HTML - this got pretty complex with all the different input types
        formContainer.innerHTML = `
            <label>
                Nazwa Scenariusza:
                <input type="text" id="scenarioName" value="${scenario.name || ''}">
            </label>
            <div class="conditions-editor">
                <h6>Warunki:</h6>
                <button id="addCondition" class="add-condition-button">Dodaj Warunek</button>
                <div id="conditionList">
                    ${Object.entries(scenario.conditions || {}).map(([conditionKey, condition]) => `
                        <div class="condition-item" data-condition="${conditionKey}">
                            <label>Nazwa: <input type="text" data-condition-name="${conditionKey}" value="${condition.label || ''}"></label>
                            <label>Waga: <input type="number" data-condition-weight="${conditionKey}" value="${condition.weight || 0}"></label>
                            <label>Typ:
                                <select data-condition-type="${conditionKey}">
                                    <option value="radio" ${condition.type === 'radio' ? 'selected' : ''}>Radio</option>
                                    <option value="checkbox" ${condition.type === 'checkbox' ? 'selected' : ''}>Checkbox</option>
                                    <option value="text" ${condition.type === 'text' ? 'selected' : ''}>Tekst</option>
                                    <option value="select" ${condition.type === 'select' ? 'selected' : ''}>Lista rozwijana</option>
                                </select>
                            </label>
                            ${condition.type === 'select' ? this.renderSelectOptions(conditionKey, condition) : ''}
                            <button class="delete-condition" data-condition="${conditionKey}">Usuń</button>
                        </div>
                    `).join('')}
                </div>
            </div>
            <div class="outputs-editor">
                <h6>Wyjścia:</h6>
                <button id="addOutput" class="add-output-button">Dodaj Wyjście</button>
                <div id="outputList">
                    ${Object.entries(scenario.outputs || {}).map(([outputKey, output]) => `
                        <div class="output-item" data-output="${outputKey}">
                            <label>Próg: <input type="number" data-output-threshold="${outputKey}" value="${output.threshold || 0}"></label>
                            <label>Wiadomość: <input type="text" data-output-message="${outputKey}" value="${output.message || ''}"></label>
                            <button class="delete-output" data-output="${outputKey}">Usuń</button>
                        </div>
                    `).join('')}
                </div>
            </div>
            <button id="saveScenario" class="save-scenario-button">Zapisz Scenariusz</button>
        `;
    
        this.initializeScenarioFormListeners(key);
    }
    
    // Helper to render select options for dropdown conditions
    renderSelectOptions(conditionKey, condition) {
        return `
            <div class="select-options" data-condition-key="${conditionKey}">
                <h6>Opcje:</h6>
                ${(condition.options || []).map((option, index) => `
                    <div class="option-item" data-option-index="${index}">
                        <label>Wartość: <input type="text" class="option-value" value="${option.value || ''}" data-index="${index}"></label>
                        <label>Etykieta: <input type="text" class="option-label" value="${option.label || ''}" data-index="${index}"></label>
                        <label>Waga: <input type="number" class="option-weight" value="${option.weight || 0}" data-index="${index}"></label>
                        <button class="delete-option" data-index="${index}">Usuń</button>
                    </div>
                `).join('')}
                <button class="add-option">Dodaj Opcję</button>
            </div>
        `;
    }
    
    // Sets up all the event listeners for the scenario editing form
    // This is complex because we need to handle updates to nested objects
    initializeScenarioFormListeners(scenarioKey) {
        const saveButton = this.containerElement.querySelector('#saveScenario');
        const addConditionButton = this.containerElement.querySelector('#addCondition');
        const addOutputButton = this.containerElement.querySelector('#addOutput');
        const deleteConditionButtons = this.containerElement.querySelectorAll('.delete-condition');
        const deleteOutputButtons = this.containerElement.querySelectorAll('.delete-output');
    
        // Handle all input changes to automatically update scenarios object
        const formInputs = this.containerElement.querySelectorAll('#scenarioEditorForm input, #scenarioEditorForm select');
        formInputs.forEach(input => {
            input.addEventListener('input', (event) => {
                const target = event.target;
                const conditionKey = target.dataset.conditionName || target.dataset.conditionWeight || target.dataset.conditionType;
    
                if (conditionKey) {
                    const condition = this.scenarios[scenarioKey].conditions[conditionKey];
                    if (target.type === 'text') {
                        condition.label = target.value;
                    } else if (target.type === 'number') {
                        condition.weight = parseFloat(target.value);
                    } else if (target.tagName === 'SELECT') {
                        condition.type = target.value;
    
                        // Initialize options for new select conditions
                        if (condition.type === 'select' && !condition.options) {
                            condition.options = [{ value: '', label: 'Nowa opcja', weight: 0 }];
                        }
                    }
                } else if (target.id === 'scenarioName') {
                    this.scenarios[scenarioKey].name = target.value;
                }
            });
        });
    
        // Save button handler - collects all form data
        if (saveButton) {
            saveButton.addEventListener('click', () => {
                const scenarioName = this.containerElement.querySelector('#scenarioName').value;
                const scenario = this.scenarios[scenarioKey];
    
                scenario.name = scenarioName;
    
                // Update all conditions
                const conditionInputs = this.containerElement.querySelectorAll('[data-condition-name]');
                conditionInputs.forEach(input => {
                    const conditionKey = input.dataset.conditionName;
                    scenario.conditions[conditionKey] = scenario.conditions[conditionKey] || {};
                    scenario.conditions[conditionKey].label = input.value;
                });
    
                const weightInputs = this.containerElement.querySelectorAll('[data-condition-weight]');
                weightInputs.forEach(input => {
                    const conditionKey = input.dataset.conditionWeight;
                    scenario.conditions[conditionKey] = scenario.conditions[conditionKey] || {};
                    scenario.conditions[conditionKey].weight = parseFloat(input.value);
                });
    
                const typeInputs = this.containerElement.querySelectorAll('[data-condition-type]');
                typeInputs.forEach(input => {
                    const conditionKey = input.dataset.conditionType;
                    scenario.conditions[conditionKey] = scenario.conditions[conditionKey] || {};
                    scenario.conditions[conditionKey].type = input.value;
                });
    
                // Update all outputs
                const outputThresholds = this.containerElement.querySelectorAll('[data-output-threshold]');
                outputThresholds.forEach(input => {
                    const outputKey = input.dataset.outputThreshold;
                    scenario.outputs[outputKey] = scenario.outputs[outputKey] || {};
                    scenario.outputs[outputKey].threshold = parseFloat(input.value);
                });
    
                const outputMessages = this.containerElement.querySelectorAll('[data-output-message]');
                outputMessages.forEach(input => {
                    const outputKey = input.dataset.outputMessage;
                    scenario.outputs[outputKey] = scenario.outputs[outputKey] || {};
                    scenario.outputs[outputKey].message = input.value;
                });
    
                this.saveScenarios();
                this.render();
            });
        }
    
        // Add new condition button handler
        if (addConditionButton) {
            addConditionButton.addEventListener('click', () => {
                const newConditionKey = `condition_${Date.now()}`;
                this.scenarios[scenarioKey].conditions[newConditionKey] = {
                    label: 'Nowy Warunek',
                    weight: 0,
                    type: 'text', // Default type
                };
                this.editScenario(scenarioKey);
            });
        }
    
        // Add new output button handler
        if (addOutputButton) {
            addOutputButton.addEventListener('click', () => {
                const newOutputKey = `output_${Date.now()}`;
                this.scenarios[scenarioKey].outputs[newOutputKey] = {
                    threshold: 0,
                    message: 'Nowe Wyjście',
                };
                this.editScenario(scenarioKey);
            });
        }
    
        // Delete condition buttons handler
        deleteConditionButtons.forEach(button => {
            button.addEventListener('click', (event) => {
                const conditionKey = event.target.dataset.condition;
                delete this.scenarios[scenarioKey].conditions[conditionKey];
                this.editScenario(scenarioKey);
            });
        });
    
        // Delete output buttons handler
        deleteOutputButtons.forEach(button => {
            button.addEventListener('click', (event) => {
                const outputKey = event.target.dataset.output;
                delete this.scenarios[scenarioKey].outputs[outputKey];
                this.editScenario(scenarioKey);
            });
        });
    
        // Handle adding options to select-type conditions
        const addOptionButtons = this.containerElement.querySelectorAll('.add-option');
        addOptionButtons.forEach(button => {
            button.addEventListener('click', (event) => {
                const conditionKey = event.target.closest('.select-options').dataset.conditionKey;
                const condition = this.scenarios[scenarioKey].conditions[conditionKey];
                condition.options = condition.options || [];
                condition.options.push({ value: '', label: 'Nowa opcja', weight: 0 });
                this.editScenario(scenarioKey);
            });
        });
    
        // Handle deleting options from select-type conditions
        const deleteOptionButtons = this.containerElement.querySelectorAll('.delete-option');
        deleteOptionButtons.forEach(button => {
            button.addEventListener('click', (event) => {
                const conditionKey = event.target.closest('.select-options').dataset.conditionKey;
                const index = parseInt(event.target.dataset.index, 10);
                const condition = this.scenarios[scenarioKey].conditions[conditionKey];
                if (condition && condition.options) {
                    condition.options.splice(index, 1);
                    this.editScenario(scenarioKey);
                }
            });
        });
    
        // Handle updating option values for select-type conditions
        const optionInputs = this.containerElement.querySelectorAll('.option-value, .option-label, .option-weight');
        optionInputs.forEach(input => {
            input.addEventListener('input', (event) => {
                const conditionKey = event.target.closest('.select-options').dataset.conditionKey;
                const index = parseInt(event.target.dataset.index, 10);
                const condition = this.scenarios[scenarioKey].conditions[conditionKey];
                const key = input.classList.contains('option-value') ? 'value'
                          : input.classList.contains('option-label') ? 'label'
                          : 'weight';
                condition.options[index][key] = key === 'weight' ? parseFloat(input.value) || 0 : input.value;
            });
        });
    }
    
    // Removes a scenario and refreshes the view
    deleteScenario(key) {
      delete this.scenarios[key];
      this.render();
    }
}
  