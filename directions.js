(() => {
  'use strict';

  function readSteps(source) {
    const lines = source.split(/\r?\n/);
    const steps = [];
    let current;
    for (const line of lines) {
      const numbered = /^(\d+)\. (\S.*)$/.exec(line);
      const ingredient = /^[ \t]+Uses: (\S.*)$/.exec(line);
      if (numbered) {
        if (Number(numbered[1]) !== steps.length + 1) return null;
        current = {text: numbered[2], ingredients: []};
        steps.push(current);
      } else if (ingredient && current) {
        current.ingredients.push(ingredient[1].trimEnd());
      } else if (current) {
        current.text += '\n' + line;
      } else if (line.trim()) {
        return null;
      }
    }
    // Some older recipes put several numbered directions in one paragraph.
    if (steps.length === 1 && !steps[0].ingredients.length && /[.;]\s*\d+\.\s/.test(steps[0].text)) return null;
    return steps.length ? steps : null;
  }

  function render(instructions) {
    const source = instructions || 'No directions recorded.';
    const steps = readSteps(source);
    const directions = document.createElement('div');
    directions.className = 'directions';
    if (!steps) {
      directions.textContent = source;
      return directions;
    }

    const list = document.createElement('ol');
    list.className = 'direction-steps';
    for (const step of steps) {
      const item = document.createElement('li');
      const instruction = document.createElement('p');
      instruction.textContent = step.text.trimEnd();
      item.append(instruction);
      if (step.ingredients.length) {
        const ingredients = document.createElement('p');
        ingredients.className = 'step-ingredients';
        ingredients.textContent = step.ingredients.join(' \u00b7 ');
        item.append(ingredients);
      }
      list.append(item);
    }
    directions.append(list);
    return directions;
  }

  window.CookbookDirections = {render};
})();
