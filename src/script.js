const runButton = document.querySelector("button");
const outputElement = document.querySelector(".output");
const codeElement = document.querySelector("textarea");

const originalLog = console.log;

runButton.addEventListener("click", () => {
    outputElement.innerHTML = "";

    console.log = (...args) => {
        originalLog(...args);
        outputElement.innerHTML += args.join(" ") + "<br>";
    };

    const codeToRun = codeElement.value;
    try {
        const evalOutputValue = eval(codeToRun);
        if (evalOutputValue !== undefined) {
            outputElement.innerHTML += evalOutputValue;
        }
    } catch (error) {
        outputElement.innerHTML += error + "<br>";
    } finally {
        console.log = originalLog;
    }
});