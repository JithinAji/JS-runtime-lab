const runButton = document.querySelector("button");
const outputElement = document.querySelector(".output");
const codeElement = document.querySelector("textarea");


runButton.addEventListener("click", () => {
    outputElement.textContent = "";
    const originalLog = console.log;

    // this prints console.log when eval calls
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
        // restoring console.log 
        // Without originalLog the console.log inside eval will be overridden
        // and it will not print the console.log
        console.log = originalLog;
    }
});