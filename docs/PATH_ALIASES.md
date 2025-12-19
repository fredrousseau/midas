# Path Aliases Configuration

This project uses **Node.js subpath imports** (package.json `imports` field) to simplify module imports and avoid long relative paths.

## Available Aliases

| Alias | Path | Usage |
|-------|------|-------|
| `#utils/*` | `./src/Utils/*` | Utility functions and helpers |
| `#trading/*` | `./src/Trading/*` | Trading services and modules |
| `#data/*` | `./src/Data/*` | Data providers and adapters |
| `#logger` | `./src/Logger/LoggerService.js` | Logging service |
| `#mcp/*` | `./src/Mcp/*` | MCP services |

## Examples

### Before (relative paths)
```javascript
// Deep nested imports - hard to read and maintain
import { round } from '../../../../Utils/statisticalHelpers.js';
import { MarketDataService } from '../../../Trading/MarketData/MarketDataService.js';
```

### After (with aliases)
```javascript
// Clean, simple imports
import { round } from '#utils/statisticalHelpers.js';
import { MarketDataService } from '#trading/MarketData/MarketDataService.js';
```

## How it Works

### package.json
```json
{
  "type": "module",
  "imports": {
    "#utils/*": "./src/Utils/*",
    "#trading/*": "./src/Trading/*",
    "#data/*": "./src/Data/*",
    "#logger": "./src/Logger/LoggerService.js",
    "#mcp/*": "./src/Mcp/*"
  }
}
```

### jsconfig.json (for IDE support)
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "#utils/*": ["src/Utils/*"],
      "#trading/*": ["src/Trading/*"],
      "#data/*": ["src/Data/*"],
      "#logger": ["src/Logger/LoggerService.js"],
      "#mcp/*": ["src/Mcp/*"]
    }
  }
}
```

## Benefits

✅ **Cleaner imports** - No more `../../../../`
✅ **Easier refactoring** - Move files without breaking imports
✅ **Better IDE support** - Autocomplete works perfectly
✅ **Consistent** - Same paths everywhere in the codebase
✅ **Native Node.js** - No build tools or transpilation needed

## Important Notes

- Path aliases **must start with `#`** (Node.js requirement)
- Works with Node.js 14.6+ (we use Node 20)
- Fully compatible with ES modules (`type: "module"`)
- IDE autocomplete supported via `jsconfig.json`

## Adding New Aliases

1. Update `package.json`:
```json
"imports": {
  "#your-alias/*": "./src/YourFolder/*"
}
```

2. Update `jsconfig.json`:
```json
"paths": {
  "#your-alias/*": ["src/YourFolder/*"]
}
```

3. Restart your IDE/editor to pick up the changes

## Resources

- [Node.js Subpath Imports](https://nodejs.org/api/packages.html#subpath-imports)
- [jsconfig.json Reference](https://code.visualstudio.com/docs/languages/jsconfig)
