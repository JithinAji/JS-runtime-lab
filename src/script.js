const doc = typeof document !== "undefined" ? document : null;

const acornParser =
  typeof acorn !== "undefined"
    ? acorn
    : typeof window !== "undefined" && window.acorn
      ? window.acorn
      : typeof globalThis !== "undefined" && globalThis.acorn
        ? globalThis.acorn
        : typeof require !== "undefined"
          ? require("acorn")
          : null;

const runButton = doc ? doc.getElementById("run-btn") : null;
const prevButton = doc ? doc.getElementById("prev-btn") : null;
const nextButton = doc ? doc.getElementById("next-btn") : null;
const toggleButton = doc ? doc.getElementById("toggle-btn") : null;
const toggleOptions = toggleButton
  ? toggleButton.querySelectorAll(".toggle-option")
  : [];
const outputElement = doc ? doc.querySelector(".output") : null;
const codeElement = doc ? doc.querySelector("textarea") : null;
const backdropElement = doc ? doc.querySelector(".editor-backdrop") : null;
const callStackElement = doc ? doc.getElementById("call-stack-list") : null;

let executionMode = "all";
let currentStepIndex = -1;
let executionSteps = [];

function escapeHtml(text) {
  return String(text)
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

function collectScopeVars(blockNode, params = []) {
  const vars = [...params];
  for (const stmt of blockNode.body || []) {
    if (stmt.type === "VariableDeclaration") {
      for (const d of stmt.declarations) {
        if (d.id && d.id.type === "Identifier" && !vars.includes(d.id.name)) {
          vars.push(d.id.name);
        }
      }
    }
  }
  return vars;
}

function makeSafeAccessor(vars) {
  if (!vars || vars.length === 0) return "{}";
  const props = vars.map(
    (v) =>
      `${JSON.stringify(v)}: (() => { try { return ${v}; } catch(e) { return "<uninitialized>"; } })()`,
  );
  return `{ ${props.join(", ")} }`;
}

function generateExecutionSteps(code) {
  if (!code || !code.trim()) return [];

  if (!acornParser) {
    return [
      {
        line: 1,
        callStack: ["Global"],
        callStackFrames: [
          {
            name: "Global",
            title: "Global",
            args: [],
            locals: {},
            returnValue: undefined,
          },
        ],
        output:
          "[Error: AST Parser (acorn) is not available. Please ensure vendor/acorn.js is loaded.]\n",
        error: true,
      },
    ];
  }

  let ast;
  try {
    ast = acornParser.parse(code, { locations: true, ecmaVersion: 2020 });
  } catch (err) {
    return [
      {
        line: err.loc ? err.loc.line : 1,
        callStack: ["Global"],
        callStackFrames: [
          {
            name: "Global",
            title: "Global",
            args: [],
            locals: {},
            returnValue: undefined,
          },
        ],
        output: `${err}\n`,
        error: true,
      },
    ];
  }

  const insertions = [];

  function processStatements(statements, scopeVars, funcName) {
    for (const stmt of statements) {
      if (stmt.type === "FunctionDeclaration") {
        const name = stmt.id ? stmt.id.name : "anonymous";
        const params = (stmt.params || [])
          .filter((p) => p.type === "Identifier")
          .map((p) => p.name);
        const innerVars = collectScopeVars(stmt.body, params);

        insertions.push({
          pos: stmt.body.start + 1,
          text: `__enter(${JSON.stringify(name)}, Array.from(arguments));try{`,
        });
        insertions.push({
          pos: stmt.body.end - 1,
          text: `}finally{__exit();}`,
        });
        processStatements(stmt.body.body, innerVars, name);
      } else if (stmt.type === "ReturnStatement") {
        insertions.push({
          pos: stmt.start,
          text: `__s=__step(${stmt.loc.start.line}, () => (${makeSafeAccessor(scopeVars)}));`,
        });
        if (stmt.argument) {
          insertions.push({
            pos: stmt.argument.start,
            text: `__return(`,
          });
          insertions.push({
            pos: stmt.argument.end,
            text: `)`,
          });
        }
        insertions.push({
          pos: stmt.end,
          text: `;__afterStep(__s);`,
        });
      } else {
        insertions.push({
          pos: stmt.start,
          text: `__s=__step(${stmt.loc.start.line}, () => (${makeSafeAccessor(scopeVars)}));`,
        });
        insertions.push({
          pos: stmt.end,
          text: `;__afterStep(__s);`,
        });

        if (stmt.type === "IfStatement") {
          if (stmt.consequent && stmt.consequent.type === "BlockStatement") {
            processStatements(stmt.consequent.body, scopeVars, funcName);
          }
          if (stmt.alternate && stmt.alternate.type === "BlockStatement") {
            processStatements(stmt.alternate.body, scopeVars, funcName);
          }
        } else if (
          (stmt.type === "ForStatement" ||
            stmt.type === "WhileStatement" ||
            stmt.type === "DoWhileStatement" ||
            stmt.type === "ForInStatement" ||
            stmt.type === "ForOfStatement") &&
          stmt.body &&
          stmt.body.type === "BlockStatement"
        ) {
          processStatements(stmt.body.body, scopeVars, funcName);
        } else if (stmt.type === "BlockStatement") {
          processStatements(stmt.body, scopeVars, funcName);
        }
      }
    }
  }

  const globalVars = collectScopeVars(ast);
  processStatements(ast.body, globalVars, "Global");
  insertions.sort((a, b) => b.pos - a.pos);

  let instrumented = code;
  for (const ins of insertions) {
    instrumented =
      instrumented.slice(0, ins.pos) + ins.text + instrumented.slice(ins.pos);
  }

  const steps = [];
  const callStack = [
    {
      name: "Global",
      title: "Global",
      args: [],
      locals: {},
      returnValue: undefined,
    },
  ];
  let cumulativeOutput = "";

  const customLog = (...args) => {
    const formatted = formatLogArguments(args);
    cumulativeOutput += `${formatted}\n`;
  };

  const __enter = (name, args) => {
    const formattedArgs = (args || [])
      .map((a) =>
        typeof a === "object" && a !== null ? JSON.stringify(a) : String(a),
      )
      .join(", ");
    const title = `${name}(${formattedArgs})`;
    callStack.push({ name, title, args, locals: {}, returnValue: undefined });
  };

  const __exit = () => {
    callStack.pop();
  };

  const __return = (val) => {
    if (callStack.length > 0) {
      callStack[callStack.length - 1].returnValue = val;
    }
    if (steps.length > 0) {
      const lastStep = steps[steps.length - 1];
      const topFrame =
        lastStep.callStackFrames[lastStep.callStackFrames.length - 1];
      if (topFrame) {
        topFrame.returnValue = val;
      }
    }
    return val;
  };

  const __step = (line, localsFn) => {
    const currentLocals = localsFn ? localsFn() : {};
    if (callStack.length > 0) {
      callStack[callStack.length - 1].locals = currentLocals;
    }
    const framesSnapshot = callStack.map((f) => ({
      name: f.name,
      title: f.title,
      args: [...f.args],
      locals: { ...f.locals },
      returnValue: f.returnValue,
    }));
    const stepObj = {
      line,
      callStack: framesSnapshot.map((f) => f.title),
      callStackFrames: framesSnapshot,
      output: cumulativeOutput,
    };
    steps.push(stepObj);
    return stepObj;
  };

  const __afterStep = (stepObj) => {
    if (stepObj && stepObj === steps[steps.length - 1]) {
      stepObj.output = cumulativeOutput;
    }
  };

  let __s = null;
  try {
    const runner = new Function(
      "__step",
      "__afterStep",
      "__enter",
      "__exit",
      "__return",
      "__s",
      "console",
      instrumented,
    );
    runner(__step, __afterStep, __enter, __exit, __return, __s, {
      log: customLog,
    });
  } catch (err) {
    steps.push({
      line: steps.length > 0 ? steps[steps.length - 1].line : 1,
      callStack: callStack.map((f) => f.title),
      callStackFrames: callStack.map((f) => ({
        name: f.name,
        title: f.title,
        args: [...f.args],
        locals: { ...f.locals },
        returnValue: f.returnValue,
      })),
      output: `${cumulativeOutput}${err}\n`,
      error: true,
    });
  }

  return steps;
}

function updateBackdrop() {
  if (!backdropElement) return;

  const currentLine =
    executionMode === "step" &&
    currentStepIndex >= 0 &&
    executionSteps[currentStepIndex]
      ? executionSteps[currentStepIndex].line
      : 0;

  if (executionMode !== "step" || currentLine === 0) {
    backdropElement.innerHTML = "";
    return;
  }

  const lines = getCodeLines(codeElement ? codeElement.value : "");
  backdropElement.innerHTML = lines
    .map((line, index) => {
      const isActive = index + 1 === currentLine;
      const activeClass = isActive ? " active" : "";
      const content = escapeHtml(line) || "&nbsp;";
      return `<div class="editor-line${activeClass}">${content}</div>`;
    })
    .join("");
}

function updateCallStackUI() {
  if (!callStackElement) return;

  if (
    executionMode !== "step" ||
    currentStepIndex < 0 ||
    !executionSteps[currentStepIndex]
  ) {
    callStackElement.innerHTML =
      '<div class="call-stack-frame empty">(empty)</div>';
    return;
  }

  const frames = executionSteps[currentStepIndex].callStackFrames || [];
  if (frames.length === 0) {
    callStackElement.innerHTML =
      '<div class="call-stack-frame empty">(empty)</div>';
    return;
  }

  // Display top frame first (call stack convention)
  const framesHtml = frames
    .slice()
    .reverse()
    .map((frame, index) => {
      const isActive = index === 0;
      const activeClass = isActive ? " active" : "";
      const title = escapeHtml(frame.title || frame.name || "anonymous");

      const localKeys = Object.keys(frame.locals || {});
      let detailsHtml = "";
      if (localKeys.length > 0) {
        const localsStr = localKeys
          .map(
            (k) => `${escapeHtml(k)}: ${escapeHtml(String(frame.locals[k]))}`,
          )
          .join(", ");
        detailsHtml += `<div class="frame-details">locals: { ${localsStr} }</div>`;
      }
      if (frame.returnValue !== undefined) {
        detailsHtml += `<div class="frame-return">return: ${escapeHtml(String(frame.returnValue))}</div>`;
      }

      return `<div class="call-stack-frame${activeClass}">
        <div class="frame-header">${title}</div>
        ${detailsHtml}
      </div>`;
    })
    .join("");

  callStackElement.innerHTML = framesHtml;
}

function updateControls() {
  if (executionMode === "all") {
    if (prevButton) prevButton.disabled = true;
    if (nextButton) nextButton.disabled = true;
    if (runButton) runButton.disabled = false;
  } else {
    const steps =
      executionSteps.length > 0
        ? executionSteps
        : generateExecutionSteps(codeElement ? codeElement.value : "");

    if (steps.length === 0) {
      if (prevButton) prevButton.disabled = true;
      if (nextButton) nextButton.disabled = true;
    } else if (currentStepIndex < 0) {
      if (prevButton) prevButton.disabled = true;
      if (nextButton) nextButton.disabled = false;
    } else {
      if (prevButton) prevButton.disabled = currentStepIndex <= 0;
      if (nextButton)
        nextButton.disabled = currentStepIndex >= steps.length - 1;
    }
    if (runButton) runButton.disabled = false;
  }
}

function applyCurrentStep() {
  if (currentStepIndex >= 0 && executionSteps[currentStepIndex]) {
    const step = executionSteps[currentStepIndex];
    if (outputElement) {
      outputElement.textContent = step.output;
    }
  }
  updateBackdrop();
  updateCallStackUI();
  updateControls();
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
  currentStepIndex = -1;
  executionSteps = [];
  updateBackdrop();
  updateCallStackUI();
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
      executionSteps = generateExecutionSteps(codeElement.value);
      if (executionSteps.length > 0) {
        currentStepIndex = 0;
      } else {
        currentStepIndex = -1;
      }
      applyCurrentStep();
    }
  });
}

if (nextButton) {
  nextButton.addEventListener("click", () => {
    if (executionMode === "step") {
      if (executionSteps.length === 0) {
        executionSteps = generateExecutionSteps(codeElement.value);
      }
      if (currentStepIndex < executionSteps.length - 1) {
        currentStepIndex++;
        applyCurrentStep();
      }
    }
  });
}

if (prevButton) {
  prevButton.addEventListener("click", () => {
    if (executionMode === "step") {
      if (currentStepIndex > 0) {
        currentStepIndex--;
        applyCurrentStep();
      }
    }
  });
}

if (codeElement) {
  codeElement.addEventListener("input", () => {
    if (executionMode === "step") {
      currentStepIndex = -1;
      executionSteps = [];
      updateBackdrop();
      updateCallStackUI();
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
    generateExecutionSteps,
    setExecutionMode,
    getExecutionMode: () => executionMode,
    getCurrentStep: () => {
      if (
        executionMode !== "step" ||
        currentStepIndex < 0 ||
        !executionSteps[currentStepIndex]
      ) {
        return 0;
      }
      return executionSteps[currentStepIndex].line;
    },
    getCurrentCallStack: () => {
      if (
        executionMode !== "step" ||
        currentStepIndex < 0 ||
        !executionSteps[currentStepIndex]
      ) {
        return [];
      }
      return executionSteps[currentStepIndex].callStack;
    },
    getCurrentCallStackFrames: () => {
      if (
        executionMode !== "step" ||
        currentStepIndex < 0 ||
        !executionSteps[currentStepIndex]
      ) {
        return [];
      }
      return executionSteps[currentStepIndex].callStackFrames;
    },
    getCurrentStepIndex: () => currentStepIndex,
    getExecutionSteps: () => executionSteps,
    updateControls,
    updateBackdrop,
    updateCallStackUI,
  };
}
