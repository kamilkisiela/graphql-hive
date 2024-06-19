import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import ts from 'typescript';

function getAllFiles(dir: string, ext: string, files: string[] = []): string[] {
  const items = fs.readdirSync(dir);
  items.forEach(item => {
    const filePath = path.join(dir, item);
    if (fs.statSync(filePath).isDirectory()) {
      getAllFiles(filePath, ext, files);
    } else if (filePath.endsWith(ext)) {
      files.push(filePath);
    }
  });
  return files;
}

// Function to extract classes and methods from a TypeScript source file
function extractClassesAndMethods(fileName: string, sourceFile: ts.SourceFile) {
  const classes: { name: string; methods: string[] }[] = [];

  function visit(node: ts.Node) {
    if (ts.isClassDeclaration(node) && node.name) {
      const className = node.name.getText();
      const methods: string[] = [];
      node.members.forEach(member => {
        if (ts.isMethodDeclaration(member) && member.name) {
          methods.push(member.name.getText());
        }
      });
      classes.push({
        name: className,
        methods: methods.filter(method => {
          return (
            method.startsWith('get') === false &&
            method.startsWith('count') === false &&
            method.startsWith('has') === false &&
            method.startsWith('read') === false
          );
        }),
      });
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return classes;
}

/**
 * script to print out classes and methods from a TypeScript source files in tsDirectory
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const tsDirectory = 'packages/services/api/src/modules/';
const projectDir = path.resolve(__dirname, tsDirectory); // Change 'src' to your project directory
const files = getAllFiles(projectDir, '.ts');

const classesAndMethods: { file: string; classes: { name: string; methods: string[] }[] }[] = [];

files.forEach(file => {
  const sourceFile = ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  const classes = extractClassesAndMethods(file, sourceFile);
  if (classes.length > 0) {
    classesAndMethods.push({ file, classes });
    console.log(JSON.stringify(classes, null, 2));
  }
});
