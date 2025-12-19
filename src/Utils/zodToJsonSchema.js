/**
 * Convert Zod schema to JSON Schema
 * Handles basic Zod types and converts them to JSON Schema format
 */

export function zodToJsonSchema(zodSchema) {
	const jsonSchema = {
		type: 'object',
		properties: {},
		required: [],
	};

	for (const [key, zodType] of Object.entries(zodSchema)) {
		const property = convertZodType(zodType);
		jsonSchema.properties[key] = property;

		// Check if property is required (not optional/default/nullable)
		const isOptional = zodType.isOptional?.() || false;
		if (!isOptional && zodType._def?.typeName !== 'ZodDefault') 
			jsonSchema.required.push(key);
		
	}

	return jsonSchema;
}

function convertZodType(zodType) {
	if (!zodType || !zodType._def) 
		return { type: 'string' };

	let def = zodType._def;
	let defaultValue = undefined;
	let description = undefined;

	// Unwrap wrappers to find the base type
	let currentType = zodType;
	while (currentType && currentType._def) {
		const typeName = currentType._def.typeName;

		if (typeName === 'ZodDefault') {
			defaultValue = currentType._def.defaultValue;
			currentType = currentType._def.innerType;
		} else if (typeName === 'ZodOptional' || typeName === 'ZodNullable') {
			currentType = currentType._def.innerType;
		} else {
			break;
		}
	}

	if (!currentType || !currentType._def) 
		return { type: 'string' };

	def = currentType._def;

	// Get description from original or current
	if (zodType._def?.description) 
		description = zodType._def.description;
	 else if (currentType._def?.description) 
		description = currentType._def.description;

	let schema = {};
	if (description) 
		schema.description = description;

	// Map Zod types to JSON Schema types
	const typeName = def.typeName;

	if (typeName === 'ZodString') {
		schema.type = 'string';
		if (def.checks) 
			for (const check of def.checks) {
				if (check.kind === 'min') schema.minLength = check.value;
				if (check.kind === 'max') schema.maxLength = check.value;
				if (check.kind === 'regex') schema.pattern = check.regex.source;
				if (check.kind === 'email') schema.format = 'email';
				if (check.kind === 'url') schema.format = 'uri';
				if (check.kind === 'uuid') schema.format = 'uuid';
			}
		
	} else if (typeName === 'ZodNumber') {
		schema.type = 'number';
		if (def.checks) 
			for (const check of def.checks) {
				if (check.kind === 'int') schema.type = 'integer';
				if (check.kind === 'min') schema.minimum = check.value;
				if (check.kind === 'max') schema.maximum = check.value;
			}
		
	} else if (typeName === 'ZodBoolean') {
		schema.type = 'boolean';
	} else if (typeName === 'ZodArray') {
		schema.type = 'array';
		if (def.type) 
			schema.items = convertZodType(def.type);
		
	} else if (typeName === 'ZodEnum') {
		schema.enum = def.values;
	} else if (typeName === 'ZodRecord') {
		schema.type = 'object';
		schema.additionalProperties = def.valueType ? convertZodType(def.valueType) : {};
	} else {
		schema.type = 'string'; // Fallback
	}

	// Add default value if present
	if (defaultValue !== undefined) 
		schema.default = typeof defaultValue === 'function' ? defaultValue() : defaultValue;

	return schema;
}

export default { zodToJsonSchema };
