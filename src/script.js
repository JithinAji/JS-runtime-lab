const runButton = document.querySelector("button");
const outputElement = document.querySelector(".output");
const codeElement = document.querySelector("textarea");

runButton.addEventListener("click", () => {
  outputElement.textContent = "";
  const originalLog = console.log;

  // Intercept console.log calls during evaluation and append output to DOM.
  console.log = (...args) => {
    originalLog(...args);

    const output = args
      .map((arg) => {
        if (typeof arg === "object" && arg !== null) {
          return JSON.stringify(arg);
        }
        return arg;
      })
      .join(" ");
    outputElement.textContent += `${output}\n`;
  };

  const codeToRun = codeElement.value;
  try {
    const result = eval(codeToRun);
    if (result !== undefined) {
      outputElement.textContent += result;
    }
  } catch (error) {
    outputElement.textContent += `${error}\n`;
  } finally {
    // Restore original console.log function after evaluation.
    console.log = originalLog;
  }
});
