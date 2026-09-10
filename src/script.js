const runButton = document.querySelector("button");
const outputElement = document.querySelector(".output");
const codeElement = document.querySelector("textarea");

const originalLog = console.log;

runButton.addEventListener("click", () => {
    outputElement.textContent = "";

    console.log = (...args) => {
        originalLog(...args);
        outputElement.textContent += args.join(" ") + "\n";
    };

    const codeToRun = codeElement.value;
    try {
        const result = eval(codeToRun);
        if (result !== undefined) {
            outputElement.textContent += result;
        }
    } catch (error) {
        outputElement.textContent += error + "\n";
    } finally {
        console.log = originalLog;
    }
});