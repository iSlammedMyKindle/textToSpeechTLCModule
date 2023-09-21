// Very basic importing of modules through JSON. If there's a config you want to use, just call it through the json array and it will be imported through the link requested
const loadedModules = [];

// Assumes an array from JSON
const moduleList = await (await fetch(window.settings.get("custmods") || "./defaultModuleList.json")).json();

// Import all the modules dynamically. They are loaded async, but the index is used to respect the order of the modules themselves
// each module is considered a function that just takes in a string and the current data
for(let i = 0; i < moduleList.length; i++)
    import(moduleList[i]).then(e=>loadedModules[i] = e);

window.runModules = function(currStr, msgData){
    for(let func of loadedModules){
        try{
            let res = func(currStr, msgData);
            currStr = res ?? currStr; // It's possible to have an empty string, just not a nullish value.

            if(currStr == res)
                console.warn("Module didn't return anything useful, using last output", func);
        }
        catch(e){
            console.error("A module had an error!", e);
        }
    }

    return currStr;
}