const test = require("node:test");
const assert = require("node:assert/strict");

// Create minimal DOM mock for testing script.js in Node
function createMockEnvironment() {
  const elements = {};

  function createElement(tag, id = "", classList = []) {
    const el = {
      tagName: tag.toUpperCase(),
      id,
      classList: new Set(classList),
      disabled: false,
      value: "",
      textContent: "",
      dataset: {},
      eventListeners: {},
      addEventListener(type, listener) {
        if (!this.eventListeners[type]) this.eventListeners[type] = [];
        this.eventListeners[type].push(listener);
      },
      dispatchEvent(event) {
        const listeners = this.eventListeners[event.type] || [];
        listeners.forEach((l) => l(event));
      },
      querySelectorAll(selector) {
        if (selector === ".toggle-option") {
          return [
            elements["toggle-option-all"],
            elements["toggle-option-step"],
          ];
        }
        return [];
      },
      closest(selector) {
        if (
          selector === ".toggle-option" &&
          this.classList.has("toggle-option")
        ) {
          return this;
        }
        return null;
      },
    };
    el.classList.toggle = (cls, force) => {
      if (force !== undefined) {
        if (force) el.classList.add(cls);
        else el.classList.delete(cls);
      } else {
        if (el.classList.has(cls)) el.classList.delete(cls);
        else el.classList.add(cls);
      }
    };
    el.classList.contains = (cls) => el.classList.has(cls);
    return el;
  }

  elements["run-btn"] = createElement("button", "run-btn", ["btn", "btn-run"]);
  elements["prev-btn"] = createElement("button", "prev-btn", [
    "btn",
    "btn-nav",
  ]);
  elements["next-btn"] = createElement("button", "next-btn", [
    "btn",
    "btn-nav",
  ]);
  elements["toggle-btn"] = createElement("button", "toggle-btn", [
    "btn",
    "btn-toggle",
  ]);
  elements["toggle-option-all"] = createElement("span", "", [
    "toggle-option",
    "active",
  ]);
  elements["toggle-option-step"] = createElement("span", "", ["toggle-option"]);
  elements["output"] = createElement("div", "", ["output"]);
  elements["textarea"] = createElement("textarea", "", []);
  elements["editor-backdrop"] = createElement("div", "", ["editor-backdrop"]);

  global.document = {
    getElementById(id) {
      return elements[id] || null;
    },
    querySelector(selector) {
      if (selector === ".output") return elements["output"];
      if (selector === "textarea") return elements["textarea"];
      if (selector === ".editor-backdrop") return elements["editor-backdrop"];
      return null;
    },
  };

  return elements;
}

test("formatLogArguments handles strings, numbers, and objects", () => {
  createMockEnvironment();
  // Clear require cache to re-execute script with mock environment
  delete require.cache[require.resolve("../src/script.js")];
  const runtime = require("../src/script.js");

  const formatted = runtime.formatLogArguments(["one", 2, { key: "val" }]);
  assert.equal(formatted, 'one 2 {"key":"val"}');
});

test("getCodeLines splits code into individual lines", () => {
  createMockEnvironment();
  delete require.cache[require.resolve("../src/script.js")];
  const runtime = require("../src/script.js");

  const lines = runtime.getCodeLines("a\nb\nc");
  assert.deepEqual(lines, ["a", "b", "c"]);
});

test("Execution mode toggling and button states", () => {
  const elements = createMockEnvironment();
  delete require.cache[require.resolve("../src/script.js")];
  const runtime = require("../src/script.js");

  // Initial state should be 'all'
  assert.equal(runtime.getExecutionMode(), "all");
  assert.equal(elements["prev-btn"].disabled, true);
  assert.equal(elements["next-btn"].disabled, true);
  assert.equal(elements["run-btn"].disabled, false);
  assert.equal(
    elements["toggle-option-all"].classList.contains("active"),
    true,
  );
  assert.equal(
    elements["toggle-option-step"].classList.contains("active"),
    false,
  );

  // Toggle to 'step'
  elements["toggle-btn"].dispatchEvent({
    type: "click",
    target: elements["toggle-btn"],
  });
  assert.equal(runtime.getExecutionMode(), "step");
  assert.equal(
    elements["toggle-option-all"].classList.contains("active"),
    false,
  );
  assert.equal(
    elements["toggle-option-step"].classList.contains("active"),
    true,
  );

  // Toggle back to 'all'
  elements["toggle-btn"].dispatchEvent({
    type: "click",
    target: elements["toggle-btn"],
  });
  assert.equal(runtime.getExecutionMode(), "all");
  assert.equal(elements["prev-btn"].disabled, true);
  assert.equal(elements["next-btn"].disabled, true);
});

test("Step-by-step navigation and incremental evaluation", () => {
  const elements = createMockEnvironment();
  delete require.cache[require.resolve("../src/script.js")];
  require("../src/script.js");

  elements["textarea"].value = [
    'console.log("step 1");',
    'console.log("step 2");',
    'console.log("step 3");',
  ].join("\n");

  // Switch to step mode
  elements["toggle-btn"].dispatchEvent({
    type: "click",
    target: elements["toggle-btn"],
  });

  // Run initial step
  elements["run-btn"].dispatchEvent({ type: "click" });
  assert.equal(elements["output"].textContent, "step 1\n");
  assert.equal(elements["prev-btn"].disabled, true);
  assert.equal(elements["next-btn"].disabled, false);

  // Step next to step 2
  elements["next-btn"].dispatchEvent({ type: "click" });
  assert.equal(elements["output"].textContent, "step 1\nstep 2\n");
  assert.equal(elements["prev-btn"].disabled, false);
  assert.equal(elements["next-btn"].disabled, false);

  // Step next to step 3 (last step)
  elements["next-btn"].dispatchEvent({ type: "click" });
  assert.equal(elements["output"].textContent, "step 1\nstep 2\nstep 3\n");
  assert.equal(elements["prev-btn"].disabled, false);
  assert.equal(elements["next-btn"].disabled, true);

  // Step previous back to step 2
  elements["prev-btn"].dispatchEvent({ type: "click" });
  assert.equal(elements["output"].textContent, "step 1\nstep 2\n");
  assert.equal(elements["prev-btn"].disabled, false);
  assert.equal(elements["next-btn"].disabled, false);

  // Step previous back to step 1
  elements["prev-btn"].dispatchEvent({ type: "click" });
  assert.equal(elements["output"].textContent, "step 1\n");
  assert.equal(elements["prev-btn"].disabled, true);
  assert.equal(elements["next-btn"].disabled, false);
});

test("All at once execution executes entire code", () => {
  const elements = createMockEnvironment();
  delete require.cache[require.resolve("../src/script.js")];
  require("../src/script.js");

  elements["textarea"].value = 'console.log("full"); 42;';
  elements["run-btn"].dispatchEvent({ type: "click" });

  assert.equal(elements["output"].textContent, "full\n42");
});

test("isExecutableLine distinguishes code from comments and blank lines", () => {
  createMockEnvironment();
  delete require.cache[require.resolve("../src/script.js")];
  const runtime = require("../src/script.js");

  assert.equal(runtime.isExecutableLine(""), false);
  assert.equal(runtime.isExecutableLine("   \t"), false);
  assert.equal(runtime.isExecutableLine("// comment"), false);
  assert.equal(runtime.isExecutableLine("  // indented comment"), false);
  assert.equal(runtime.isExecutableLine("/* block */"), false);
  assert.equal(runtime.isExecutableLine(" * middle of block"), false);
  assert.equal(runtime.isExecutableLine("console.log('hi');"), true);
  assert.equal(runtime.isExecutableLine("const x = 1; // with comment"), true);
});

test("getExecutableStepIndices returns 1-based indices of executable lines", () => {
  createMockEnvironment();
  delete require.cache[require.resolve("../src/script.js")];
  const runtime = require("../src/script.js");

  const lines = ["// intro", "let a = 1;", "", "// middle", "console.log(a);"];
  const indices = runtime.getExecutableStepIndices(lines);
  assert.deepEqual(indices, [2, 5]);
});

test("Step navigation skips comments and blank lines while highlighting active line in backdrop", () => {
  const elements = createMockEnvironment();
  delete require.cache[require.resolve("../src/script.js")];
  const runtime = require("../src/script.js");

  elements["textarea"].value = [
    "// line 1: comment",
    'console.log("one");',
    "",
    "// line 4: another comment",
    'console.log("two");',
  ].join("\n");

  // Switch to step mode
  elements["toggle-btn"].dispatchEvent({
    type: "click",
    target: elements["toggle-btn"],
  });

  // Clicking Run should start at the first executable line (line 2)
  elements["run-btn"].dispatchEvent({ type: "click" });
  assert.equal(runtime.getCurrentStep(), 2);
  assert.equal(elements["output"].textContent, "one\n");
  assert.equal(elements["prev-btn"].disabled, true);
  assert.equal(elements["next-btn"].disabled, false);

  // Check backdrop contains active class on line 2
  assert.match(
    elements["editor-backdrop"].innerHTML,
    /<div class="editor-line active">console\.log\(&quot;one&quot;\);<\/div>/,
  );
  assert.match(
    elements["editor-backdrop"].innerHTML,
    /<div class="editor-line">\/\/ line 1: comment<\/div>/,
  );

  // Next step should skip line 3 (blank) and line 4 (comment), landing on line 5
  elements["next-btn"].dispatchEvent({ type: "click" });
  assert.equal(runtime.getCurrentStep(), 5);
  assert.equal(elements["output"].textContent, "one\ntwo\n");
  assert.equal(elements["prev-btn"].disabled, false);
  assert.equal(elements["next-btn"].disabled, true);

  // Check backdrop active line updated to line 5
  assert.match(
    elements["editor-backdrop"].innerHTML,
    /<div class="editor-line active">console\.log\(&quot;two&quot;\);<\/div>/,
  );

  // Prev step should jump back to line 2
  elements["prev-btn"].dispatchEvent({ type: "click" });
  assert.equal(runtime.getCurrentStep(), 2);
  assert.equal(elements["output"].textContent, "one\n");
  assert.equal(elements["prev-btn"].disabled, true);
  assert.equal(elements["next-btn"].disabled, false);

  // Typing in textarea should reset currentStep and clear the backdrop highlight
  elements["textarea"].dispatchEvent({ type: "input" });
  assert.equal(runtime.getCurrentStep(), 0);
  assert.equal(elements["editor-backdrop"].innerHTML, "");
});
