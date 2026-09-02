import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const schemas = join(fileURLToPath(new URL('../src/schemas/', import.meta.url)));
function visit(schema, label = '$') {
  if (schema && typeof schema === 'object') {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (types.includes('object')) {
      assert.equal(schema.additionalProperties, false, `${label} must reject additional properties`);
      const properties = schema.properties || {}; const required = schema.required || [];
      assert.deepEqual([...required].sort(), Object.keys(properties).sort(), `${label} required keys must exactly match properties`);
      for (const [name, child] of Object.entries(properties)) visit(child, `${label}.${name}`);
    }
    if (schema.items) visit(schema.items, `${label}[]`);
    for (const [name, child] of Object.entries(schema)) if (!['properties', 'items'].includes(name) && child && typeof child === 'object') {
      if (Array.isArray(child)) child.forEach((item, index) => visit(item, `${label}.${name}[${index}]`));
    }
  }
}

test('every Codex structured-output schema is recursively strict and complete', () => {
  for (const name of readdirSync(schemas).filter((item) => item.endsWith('.schema.json'))) visit(JSON.parse(readFileSync(join(schemas, name), 'utf8')), name);
});

test('HumanAction is strictly defined in every schema that uses it', () => {
  for (const name of ['tech-lead.schema.json', 'implementer.schema.json']) {
    const schema = JSON.parse(readFileSync(join(schemas, name), 'utf8')); const action = schema.properties.human_action;
    assert.equal(action.additionalProperties, false); assert.ok(action.required.includes('steps')); assert.equal(action.properties.steps.items.type, 'string');
  }
});
