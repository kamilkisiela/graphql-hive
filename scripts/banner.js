// Adds missing require function (reason: node_modules are not transpiled)
import { createRequire as _createRequire } from 'module';
const require = _createRequire(import.meta.url);
