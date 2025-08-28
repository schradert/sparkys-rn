import type {
	ExternalProductSheet,
	InternalProductSheet,
} from "@/constants/Products";

interface SheetsResponse {
	range: string;
	majorDimension: string;
	values: string[][];
}

export class GoogleSheetsService {
	private baseUrl = "https://sheets.googleapis.com/v4/spreadsheets";
	private spreadsheetId: string;

	constructor(spreadsheetId: string) {
		this.spreadsheetId = spreadsheetId;
	}

	private async makeRequest(
		endpoint: string,
		accessToken: string,
	): Promise<any> {
		const url = `${this.baseUrl}/${this.spreadsheetId}/${endpoint}`;

		console.log("Making request to:", url);

		const response = await fetch(url, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
			},
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error("Sheets API error:", {
				status: response.status,
				statusText: response.statusText,
				url,
				error: errorText,
			});
			throw new Error(
				`Sheets API error: ${response.status} ${response.statusText} - ${errorText}`,
			);
		}

		return response.json();
	}

	async getSheetData(
		sheetName: string,
		accessToken: string,
	): Promise<string[][]> {
		const range = `${sheetName}!A:Z`;
		const endpoint = `values/${encodeURIComponent(range)}`;
		const data: SheetsResponse = await this.makeRequest(endpoint, accessToken);

		return data.values || [];
	}

	async getMetadataValues(
		sheetName: string,
		accessToken: string,
	): Promise<string[]> {
		const values = await this.getSheetData(sheetName, accessToken);

		if (values.length === 0) return [];

		const headerRow = values[0];
		const nameColumnIndex = headerRow.findIndex(
			(header) => header.toLowerCase() === "name",
		);

		if (nameColumnIndex === -1) {
			throw new Error(`No 'name' column found in ${sheetName} sheet`);
		}

		return values
			.slice(1)
			.map((row) => row[nameColumnIndex])
			.filter((value) => value && value.trim() !== "");
	}

	async getProductData(accessToken: string): Promise<ProductSheet[]> {
		const values = await this.getSheetData("products", accessToken);

		if (values.length === 0) {
			console.log("No data found in products sheet");
			return [];
		}

		const headerRow = values[0];
		const products: ProductSheet[] = [];

		console.log("Raw headers:", headerRow);

		const columnMap: { [key: string]: number } = {};
		headerRow.forEach((header, index) => {
			const normalizedHeader = header.toLowerCase().replace(/\s+/g, "_");
			columnMap[normalizedHeader] = index;
		});

		console.log("Normalized column map:", columnMap);

		const columnMappings = {
			id: ["unique_id_sku"],
			name: ["sparkys_product_name"],
			product_type: ["product_type"],
			occasion: ["occasion"],
			color: ["manufacturer_color"],
			manufacturer: ["brand"],
			size: ["size"],
			texture: ["texture"],
			quantity: ["quantity"],
			bag_quantity: ["bag_quantity"],
			shape: ["shape"],
			distributor: ["distributor"],
		};

		const resolvedColumns: { [key: string]: number } = {};

		for (const [key, possibleHeaders] of Object.entries(columnMappings)) {
			let foundIndex = -1;
			for (const header of possibleHeaders) {
				if (columnMap[header] !== undefined) {
					foundIndex = columnMap[header];
					break;
				}
			}
			if (foundIndex !== -1) {
				resolvedColumns[key] = foundIndex;
			}
		}

		console.log("Resolved columns:", resolvedColumns);

		const requiredColumns = [
			"id",
			"name",
			"product_type",
			"quantity",
			"bag_quantity",
		];
		for (const column of requiredColumns) {
			if (resolvedColumns[column] === undefined) {
				console.error(`Missing required column: ${column}`);
				throw new Error(
					`Required column for '${column}' not found in products sheet`,
				);
			}
		}

		console.log(`Processing ${values.length - 1} product rows...`);

		for (let i = 1; i < values.length; i++) {
			const row = values[i];

			if (!row[resolvedColumns.id] || row[resolvedColumns.id].trim() === "") {
				console.log(`Skipping row ${i}: empty ID`);
				continue;
			}

			try {
				const product: ProductSheet = {
					id: row[resolvedColumns.id],
					name: row[resolvedColumns.name] || "",
					product_type: row[resolvedColumns.product_type] || "",
					occasion: row[resolvedColumns.occasion] || "",
					color: row[resolvedColumns.color] || "",
					manufacturer: row[resolvedColumns.manufacturer] || "",
					size: row[resolvedColumns.size] || "",
					texture: row[resolvedColumns.texture] || "",
					quantity: parseInt(row[resolvedColumns.quantity] || "0", 10),
					bag_quantity: parseInt(row[resolvedColumns.bag_quantity] || "50", 10),
					shape: row[resolvedColumns.shape] || "",
					distributor: row[resolvedColumns.distributor] || "",
					image_url: undefined,
				};

				console.log(`Parsed product ${i}:`, product);
				products.push(product);
			} catch (error) {
				console.warn(`Error parsing product row ${i}:`, error);
			}
		}

		console.log(`Successfully parsed ${products.length} products`);

		return products;
	}

	async getInternalProductData(accessToken: string): Promise<any[]> {
		console.log("Fetching internal_products sheet...");
		const data = await this.getSheetData("internal_products", accessToken);
		console.log("Internal products sheet data:", data);
		if (!data || data.length < 2) {
			console.log("No internal products data found or insufficient rows");
			return [];
		}

		const headers = data[0];
		const values = data;

		const products: any[] = [];

		// Header: sparkys_product_name, product_type, sparkys_color, texture, shape, occasions, products
		for (let i = 1; i < values.length; i++) {
			const row = values[i];
			if (!row[0] || row[0].trim() === "") continue;

			const product: any = {
				sparkys_product_name: row[0] || "",
				product_type: row[1] || "",
				sparkys_color: row[2] || "",
				texture: row[3] || "",
				shape: row[4] || "",
				occasions: row[5] || "", // comma-separated
				products: row[6] || "", // comma-separated barcodes
			};
			console.log("Parsed internal product:", product);

			products.push(product);
		}

		console.log("Returning", products.length, "internal products");
		return products;
	}

	async getExternalProductData(accessToken: string): Promise<any[]> {
		console.log("Fetching external_products sheet...");
		const data = await this.getSheetData("external_products", accessToken);
		console.log("External products sheet data:", data);
		if (!data || data.length < 2) {
			console.log("No external products data found or insufficient rows");
			return [];
		}

		const headers = data[0];
		const values = data;

		const products: any[] = [];

		// Header: unique_id_sku, manufacturer_color, brand, size, bag_quantity, distributors, quantity
		for (let i = 1; i < values.length; i++) {
			const row = values[i];
			if (!row[0] || row[0].trim() === "") continue;

			const product: any = {
				unique_id_sku: row[0] || "",
				manufacturer_color: row[1] || "",
				brand: row[2] || "",
				size: row[3] || "",
				bag_quantity: parseInt(row[4] || "0", 10),
				distributors: row[5] || "", // comma-separated
				quantity: parseInt(row[6] || "0", 10),
			};
			console.log("Parsed external product:", product);

			products.push(product);
		}

		console.log("Returning", products.length, "external products");
		return products;
	}

	async getAllSheetsData(accessToken: string) {
		try {
			const [
				productTypes,
				occasions,
				manufacturerColors,
				sparkyColors,
				brands,
				shapes,
				textures,
				distributors,
				bagQuantities,
				internalProducts,
				externalProducts,
			] = await Promise.all([
				this.getMetadataValues("product_types", accessToken),
				this.getMetadataValues("occasions", accessToken),
				this.getMetadataValues("manufacturer_colors", accessToken),
				this.getMetadataValues("sparkys_colors", accessToken),
				this.getMetadataValues("brands", accessToken),
				this.getMetadataValues("shapes", accessToken),
				this.getMetadataValues("textures", accessToken),
				this.getMetadataValues("distributors", accessToken),
				this.getMetadataValues("bag_quantities", accessToken),
				this.getInternalProductData(accessToken),
				this.getExternalProductData(accessToken),
			]);

			const uniqueSizes = [
				...new Set(externalProducts.map((p) => p.size).filter(Boolean)),
			].sort();

			return {
				metadata: {
					productType: productTypes,
					manufacturer_color: manufacturerColors,
					sparkys_color: sparkyColors,
					manufacturer: brands,
					size: uniqueSizes,
					texture: textures,
					bagQuantity: bagQuantities,
					shape: shapes,
					distributor: distributors,
					occasion: occasions,
				},
				internalProducts,
				externalProducts,
			};
		} catch (error) {
			console.error("Error fetching sheets data:", error);
			throw error;
		}
	}

	async appendToSheet(
		sheetName: string,
		values: string[][],
		accessToken: string,
	): Promise<void> {
		const endpoint = `values/${encodeURIComponent(sheetName)}:append?valueInputOption=USER_ENTERED`;

		const body = {
			values: values,
		};

		const response = await fetch(
			`${this.baseUrl}/${this.spreadsheetId}/${endpoint}`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${accessToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify(body),
			},
		);

		if (!response.ok) {
			const errorText = await response.text();
			console.error("Sheets append error:", {
				status: response.status,
				statusText: response.statusText,
				error: errorText,
			});
			throw new Error(
				`Failed to append to sheet: ${response.status} ${response.statusText}`,
			);
		}

		console.log(`Successfully appended ${values.length} rows to ${sheetName}`);
	}

	async getNextId(sheetName: string, accessToken: string): Promise<number> {
		const values = await this.getSheetData(sheetName, accessToken);

		if (values.length <= 1) return 1;

		const headerRow = values[0];
		const idColumnIndex = headerRow.findIndex(
			(header) => header.toLowerCase() === "id",
		);

		if (idColumnIndex === -1) return 1;

		let maxId = 0;
		for (let i = 1; i < values.length; i++) {
			const row = values[i];
			const id = parseInt(row[idColumnIndex] || "0", 10);
			if (id > maxId) {
				maxId = id;
			}
		}

		return maxId + 1;
	}

	async addMetadataItem(
		sheetName: string,
		name: string,
		accessToken: string,
	): Promise<void> {
		const nextId = await this.getNextId(sheetName, accessToken);
		const newRow = [name, nextId.toString()];

		await this.appendToSheet(sheetName, [newRow], accessToken);
		console.log(
			`Added metadata item: ${name} with id ${nextId} to ${sheetName}`,
		);
	}

	async addProduct(product: ProductSheet, accessToken: string): Promise<void> {
		const newRow = [
			product.id,
			product.name,
			product.product_type,
			product.color,
			product.manufacturer,
			product.size,
			product.texture,
			product.bag_quantity.toString(),
			product.shape,
			product.distributor,
			product.occasion,
			product.quantity.toString(),
		];

		await this.appendToSheet("products", [newRow], accessToken);
		console.log(
			`Added product: ${product.name} (${product.id}) to products sheet`,
		);
	}

	async findRowByValue(
		sheetName: string,
		columnName: string,
		value: string,
		accessToken: string,
	): Promise<number | null> {
		const values = await this.getSheetData(sheetName, accessToken);

		if (values.length === 0) return null;

		const headerRow = values[0];
		const columnIndex = headerRow.findIndex(
			(header) => header.toLowerCase() === columnName.toLowerCase(),
		);

		if (columnIndex === -1) return null;

		for (let i = 1; i < values.length; i++) {
			if (values[i][columnIndex] === value) {
				return i + 1; // Return 1-based row number for sheets API
			}
		}

		return null;
	}

	async updateRow(
		sheetName: string,
		rowNumber: number,
		values: string[],
		accessToken: string,
	): Promise<void> {
		const range = `${sheetName}!A${rowNumber}:Z${rowNumber}`;
		const endpoint = `values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;

		const body = {
			values: [values],
		};

		const response = await fetch(
			`${this.baseUrl}/${this.spreadsheetId}/${endpoint}`,
			{
				method: "PUT",
				headers: {
					Authorization: `Bearer ${accessToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify(body),
			},
		);

		if (!response.ok) {
			const errorText = await response.text();
			console.error("Sheets update error:", {
				status: response.status,
				statusText: response.statusText,
				error: errorText,
			});
			throw new Error(
				`Failed to update sheet: ${response.status} ${response.statusText}`,
			);
		}

		console.log(`Successfully updated row ${rowNumber} in ${sheetName}`);
	}

	async updateMetadataItem(
		sheetName: string,
		oldName: string,
		newName: string,
		accessToken: string,
	): Promise<void> {
		const rowNumber = await this.findRowByValue(
			sheetName,
			"name",
			oldName,
			accessToken,
		);
		if (!rowNumber) {
			throw new Error(`Metadata item "${oldName}" not found in ${sheetName}`);
		}

		// Get the existing row to preserve the ID
		const values = await this.getSheetData(sheetName, accessToken);
		const existingRow = values[rowNumber - 1]; // Convert to 0-based index
		const id = existingRow[1]; // ID is in second column

		// Update the metadata sheet
		const updatedRow = [newName, id];
		await this.updateRow(sheetName, rowNumber, updatedRow, accessToken);
		console.log(
			`Updated metadata item from "${oldName}" to "${newName}" in ${sheetName}`,
		);

		// Update all products that use this metadata value
		await this.updateProductsWithMetadataChange(
			sheetName,
			oldName,
			newName,
			accessToken,
		);
	}

	async updateProductsWithMetadataChange(
		metadataSheetName: string,
		oldValue: string,
		newValue: string,
		accessToken: string,
	): Promise<void> {
		console.log(
			`DEBUG: Starting cascade update for ${metadataSheetName}: "${oldValue}" -> "${newValue}"`,
		);

		// Get the column name in products sheet based on metadata sheet name
		const productColumnName =
			this.getProductColumnForMetadataSheet(metadataSheetName);
		if (!productColumnName) {
			console.log(
				`No corresponding product column for metadata sheet: ${metadataSheetName}`,
			);
			return;
		}
		console.log(`DEBUG: Product column name: ${productColumnName}`);

		const products = await this.getSheetData("products", accessToken);
		if (products.length === 0) {
			console.log("DEBUG: No products found");
			return;
		}
		console.log(`DEBUG: Found ${products.length - 1} product rows`);

		const headerRow = products[0];
		console.log(`DEBUG: Header row:`, headerRow);

		const columnIndex = headerRow.findIndex(
			(header) => header.toLowerCase() === productColumnName.toLowerCase(),
		);

		if (columnIndex === -1) {
			console.log(
				`DEBUG: Column ${productColumnName} not found in products sheet. Available columns:`,
				headerRow,
			);
			return;
		}
		console.log(`DEBUG: Found column at index ${columnIndex}`);

		// Find all products that need updating
		const rowsToUpdate: { rowNumber: number; values: string[] }[] = [];

		for (let i = 1; i < products.length; i++) {
			const row = products[i];
			const currentValue = row[columnIndex];
			console.log(
				`DEBUG: Row ${i} - Current value in column ${columnIndex}: "${currentValue}", comparing to "${oldValue}"`,
			);

			if (currentValue === oldValue) {
				console.log(`DEBUG: Found match! Updating row ${i}`);
				// Create updated row with new metadata value
				const updatedRow = [...row];
				updatedRow[columnIndex] = newValue;
				rowsToUpdate.push({
					rowNumber: i + 1, // 1-based for sheets API
					values: updatedRow,
				});
			}
		}

		console.log(`DEBUG: Found ${rowsToUpdate.length} products to update`);

		// Update all rows that need changing
		for (const update of rowsToUpdate) {
			console.log(
				`DEBUG: Updating row ${update.rowNumber} with new value "${newValue}"`,
			);
			await this.updateRow(
				"products",
				update.rowNumber,
				update.values,
				accessToken,
			);
		}

		console.log(
			`Updated ${rowsToUpdate.length} products with metadata change from "${oldValue}" to "${newValue}"`,
		);
	}

	private getProductColumnForMetadataSheet(
		metadataSheetName: string,
	): string | null {
		switch (metadataSheetName) {
			case "product_types":
				return "product_type";
			case "colors":
				return "manufacturer_color";
			case "brands":
				return "brand";
			case "textures":
				return "texture";
			case "shapes":
				return "shape";
			case "distributors":
				return "distributor";
			case "occasions":
				return "occasion";
			case "bag_quantities":
				return "bag_quantity";
			default:
				return null;
		}
	}

	async updateProduct(
		product: ProductSheet,
		accessToken: string,
	): Promise<void> {
		const rowNumber = await this.findRowByValue(
			"products",
			"unique_id_sku",
			product.id,
			accessToken,
		);
		if (!rowNumber) {
			throw new Error(`Product with ID "${product.id}" not found`);
		}

		const updatedRow = [
			product.id, // Keep existing ID
			product.name, // Keep existing name (not editable)
			product.product_type,
			product.color,
			product.manufacturer,
			product.size,
			product.texture,
			product.bag_quantity.toString(),
			product.shape,
			product.distributor,
			product.occasion,
			product.quantity.toString(),
		];

		await this.updateRow("products", rowNumber, updatedRow, accessToken);
		console.log(`Updated product: ${product.name} (${product.id})`);
	}
}
