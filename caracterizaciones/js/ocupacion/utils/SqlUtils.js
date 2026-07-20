export class SqlUtils {
    static escapeString(value) {
        return String(value).replace(/'/g, "''");
    }

    static equals(field, value, fieldType = "string") {
        if (!field) return null;
        const text = String(value ?? "").trim();
        if (text === "") return null;

        const isNumeric = ["small-integer", "integer", "single", "double", "long", "number"].includes(fieldType);
        if (isNumeric && !Number.isNaN(Number(text))) {
            return `${field} = ${Number(text)}`;
        }

        return `${field} = '${this.escapeString(text)}'`;
    }

    static buildInClause(field, values, fieldType = "string") {
        if (!field || !values?.length) return null;

        const isNumeric = ["small-integer", "integer", "single", "double", "long", "number"].includes(fieldType);
        const formattedValues = values.map(value => {
            const text = String(value ?? "").trim();
            if (isNumeric && text !== "" && !Number.isNaN(Number(text))) {
                return Number(text);
            }

            return `'${this.escapeString(text)}'`;
        });

        return `${field} IN (${formattedValues.join(",")})`;
    }

    static combine(...clauses) {
        return clauses.filter(Boolean).map(clause => `(${clause})`).join(" AND ");
    }
}
