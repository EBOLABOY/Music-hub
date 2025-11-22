export const validateRequest = (schema) => {
    return (req, res, next) => {
        const errors = [];

        if (schema.query) {
            for (const [key, validator] of Object.entries(schema.query)) {
                const value = req.query[key];
                const error = validator(value);
                if (error) errors.push(`Query param '${key}': ${error}`);
            }
        }

        if (schema.body) {
            for (const [key, validator] of Object.entries(schema.body)) {
                const value = req.body[key];
                const error = validator(value);
                if (error) errors.push(`Body param '${key}': ${error}`);
            }
        }

        if (schema.params) {
            for (const [key, validator] of Object.entries(schema.params)) {
                const value = req.params[key];
                const error = validator(value);
                if (error) errors.push(`URL param '${key}': ${error}`);
            }
        }

        if (errors.length > 0) {
            return res.status(400).json({ error: 'Validation failed', details: errors });
        }

        next();
    };
};

export const validators = {
    required: (value) => (value === undefined || value === null || value === '' ? 'is required' : null),
    string: (value) => (value && typeof value !== 'string' ? 'must be a string' : null),
    number: (value) => (value && isNaN(Number(value)) ? 'must be a number' : null),
    isIn: (options) => (value) => (value && !options.includes(value) ? `must be one of: ${options.join(', ')}` : null)
};
