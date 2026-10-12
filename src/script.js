const runButton = document.getElementById("run-btn");
const prevButton = document.getElementById("prev-btn");
const nextButton = document.getElementById("next-btn");
const toggleButton = document.getElementById("toggle-btn");
const toggleOptions = toggleButton
  ? toggleButton.querySelectorAll(".toggle-option")
  : [];
const outputElement = document.querySelector(".output");
const codeElement = document.querySelector("textarea");
const backdropElement = document.querySelector(".editor-backdrop");

let executionMode = "all";
let currentStep = 0;

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function isExecutableLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("//")) return false;
  if (
    trimmed.startsWith("/*") ||
    trimmed.startsWith("*") ||
    trimmed.endsWith("*/")
  ) {
    return false;
  }
  return true;
}

function getExecutableStepIndices(lines) {
  const indices = [];
  lines.forEach((line, index) => {
    if (isExecutableLine(line)) {
      indices.push(index + 1);
    }
  });
  return indices;
}

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

function updateBackdrop() {
  if (!backdropElement) return;

  if (executionMode !== "step" || currentStep === 0) {
    backdropElement.innerHTML = "";
    return;
  }

  const lines = getCodeLines(codeElement ? codeElement.value : "");
  backdropElement.innerHTML = lines
    .map((line, index) => {
      const isActive = index + 1 === currentStep;
      const activeClass = isActive ? " active" : "";
      const content = escapeHtml(line) || "&nbsp;";
      return `<div class="editor-line${activeClass}">${content}</div>`;
    })
    .join("");
}

function updateControls() {
  if (executionMode === "all") {
    if (prevButton) prevButton.disabled = true;
    if (nextButton) nextButton.disabled = true;
    if (runButton) runButton.disabled = false;
  } else {
    const lines = getCodeLines(codeElement ? codeElement.value : "");
    const executableSteps = getExecutableStepIndices(lines);

    if (executableSteps.length === 0) {
      if (prevButton) prevButton.disabled = true;
      if (nextButton) nextButton.disabled = true;
    } else if (currentStep === 0) {
      if (prevButton) prevButton.disabled = true;
      if (nextButton) nextButton.disabled = false;
    } else {
      const firstStep = executableSteps[0];
      const lastStep = executableSteps[executableSteps.length - 1];
      if (prevButton) prevButton.disabled = currentStep <= firstStep;
      if (nextButton) nextButton.disabled = currentStep >= lastStep;
    }
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
  updateBackdrop();
  updateControls();
}

function executeCurrentStep() {
  const lines = getCodeLines(codeElement ? codeElement.value : "");
  const codeSubset = lines.slice(0, currentStep).join("\n");
  executeCode(codeSubset);
  updateBackdrop();
  updateControls();
}

if (codeElement && backdropElement) {
  codeElement.addEventListener("scroll", () => {
    backdropElement.scrollTop = codeElement.scrollTop;
    backdropElement.scrollLeft = codeElement.scrollLeft;
  });
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
      const executableSteps = getExecutableStepIndices(lines);
      if (executableSteps.length > 0) {
        currentStep = executableSteps[0];
        executeCurrentStep();
      }
    }
  });
}

if (nextButton) {
  nextButton.addEventListener("click", () => {
    if (executionMode === "step") {
      const lines = getCodeLines(codeElement.value);
      const executableSteps = getExecutableStepIndices(lines);
      const nextStep = executableSteps.find((step) => step > currentStep);
      if (nextStep !== undefined) {
        currentStep = nextStep;
        executeCurrentStep();
      }
    }
  });
}

if (prevButton) {
  prevButton.addEventListener("click", () => {
    if (executionMode === "step") {
      const lines = getCodeLines(codeElement.value);
      const executableSteps = getExecutableStepIndices(lines);
      const prevSteps = executableSteps.filter((step) => step < currentStep);
      if (prevSteps.length > 0) {
        currentStep = prevSteps[prevSteps.length - 1];
        executeCurrentStep();
      }
    }
  });
}

if (codeElement) {
  codeElement.addEventListener("input", () => {
    if (executionMode === "step") {
      currentStep = 0;
      updateBackdrop();
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
    isExecutableLine,
    getExecutableStepIndices,
    setExecutionMode,
    getExecutionMode: () => executionMode,
    getCurrentStep: () => currentStep,
    updateControls,
    updateBackdrop,
  };
}
