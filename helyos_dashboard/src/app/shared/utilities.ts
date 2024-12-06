import * as yaml from 'js-yaml';

// check if an object has a property
function isObjectProperty(object: object, propertyName: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, propertyName);
}

// download an object as a file
function downloadObject(content: any, fileName: string, contentType: string): void {
  const a = document.createElement("a");
  const file = new Blob([content], { type: contentType });
  a.href = URL.createObjectURL(file);
  a.download = fileName;
  a.click();
}

// dump an object to YAML format
function yamlDump(object: any): string {
  return yaml.dump(object);
}

// load a YAML string into an object
function yamlLoad(string: string): any {
  return yaml.load(string);
}

export {
  isObjectProperty,
  downloadObject,
  yamlDump,
  yamlLoad
};
