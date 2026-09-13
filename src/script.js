const runButton = document.querySelector("button");
const outputElement = document.querySelector(".output");
const codeElement = document.querySelector("textarea");

const originalLog = console.log;

runButton.addEventListener("click", () => {
    outputElement.textContent = "";

    console.log = (...args) => {
        originalLog(...args);

        const output = args.map(arg => {
            if (typeof arg === "object" && arg !== null) {
                return JSON.stringify(arg);
            }
            return arg;
        }).join(" ");
        outputElement.textContent += output + "\n";
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