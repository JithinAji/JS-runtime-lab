const runButton = document.getElementById("run-btn");
const prevButton = document.getElementById("prev-btn");
const nextButton = document.getElementById("next-btn");
const toggleButton = document.getElementById("toggle-btn");
const toggleOptions = toggleButton
  ? toggleButton.querySelectorAll(".toggle-option")
  : [];
const outputElement = document.querySelector(".output");
const codeElement = document.querySelector("textarea");

let executionMode = "all";
let currentStep = 0;

function formatLogArguments(args) {
  return args
    .map((arg) => {
      if (typeof arg === "object" && arg !== null) {
        return JSON.stringify(arg);
      }
      return arg;
    })
    .join(" ");
}

function executeCode(code) {
  if (!outputElement) return;
  outputElement.textContent = "";
  const originalLog = console.log;

  // Intercept console.log calls during evaluation and append output to DOM.
  console.log = (...args) => {
    originalLog(...args);
    const output = formatLogArguments(args);
    outputElement.textContent += `${output}\n`;
  };

  try {
    const result = eval(code);
    if (result !== undefined) {
      outputElement.textContent += result;
    }
  } catch (error) {
    outputElement.textContent += `${error}\n`;
  } finally {
    // Restore original console.log function after evaluation.
    console.log = originalLog;
  }
}

function getCodeLines(code) {
  return code ? code.split("\n") : [];
}

function updateControls() {
  if (executionMode === "all") {
    if (prevButton) prevButton.disabled = true;
    if (nextButton) nextButton.disabled = true;
    if (runButton) runButton.disabled = false;
  } else {
    const lines = getCodeLines(codeElement ? codeElement.value : "");
    const totalSteps = lines.length;
    if (prevButton) prevButton.disabled = currentStep <= 1;
    if (nextButton) nextButton.disabled = currentStep >= totalSteps;
    if (runButton) runButton.disabled = false;
  }
}

function setExecutionMode(mode) {
  executionMode = mode;
  if (toggleButton) {
    toggleButton.dataset.mode = mode;
  }
  if (toggleOptions.length >= 2) {
    toggleOptions[0].classList.toggle("active", mode === "all");
    toggleOptions[1].classList.toggle("active", mode === "step");
  }
  currentStep = 0;
  updateControls();
}

function executeCurrentStep() {
  const lines = getCodeLines(codeElement ? codeElement.value : "");
  const codeSubset = lines.slice(0, currentStep).join("\n");
  executeCode(codeSubset);
  updateControls();
}

if (toggleButton) {
  toggleButton.addEventListener("click", (event) => {
    const clickedOption = event.target.closest(".toggle-option");
    if (clickedOption && toggleOptions.length >= 2) {
      const targetMode = clickedOption === toggleOptions[1] ? "step" : "all";
      setExecutionMode(targetMode);
    } else {
      const nextMode = executionMode === "all" ? "step" : "all";
      setExecutionMode(nextMode);
    }
  });
}

if (runButton) {
  runButton.addEventListener("click", () => {
    if (executionMode === "all") {
      executeCode(codeElement.value);
    } else {
      const lines = getCodeLines(codeElement.value);
      if (lines.length > 0) {
        currentStep = 1;
        executeCurrentStep();
      }
    }
  });
}

if (nextButton) {
  nextButton.addEventListener("click", () => {
    if (executionMode === "step") {
      const lines = getCodeLines(codeElement.value);
      if (currentStep < lines.length) {
        currentStep += 1;
        executeCurrentStep();
      }
    }
  });
}

if (prevButton) {
  prevButton.addEventListener("click", () => {
    if (executionMode === "step" && currentStep > 1) {
      currentStep -= 1;
      executeCurrentStep();
    }
  });
}

if (codeElement) {
  codeElement.addEventListener("input", () => {
    if (executionMode === "step") {
      currentStep = 0;
      updateControls();
    }
  });
}

// Initialize default mode and control states.
if (typeof document !== "undefined") {
  setExecutionMode("all");
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    formatLogArguments,
    getCodeLines,
    setExecutionMode,
    getExecutionMode: () => executionMode,
    getCurrentStep: () => currentStep,
    updateControls,
  };
}
