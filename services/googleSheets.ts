import type { ProductSheet } from "@/constants/Products";

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

	async getAllSheetsData(accessToken: string) {
		try {
			const [
				productTypes,
				occasions,
				colors,
				brands,
				shapes,
				textures,
				distributors,
				bagQuantities,
				products,
			] = await Promise.all([
				this.getMetadataValues("product_types", accessToken),
				this.getMetadataValues("occasions", accessToken),
				this.getMetadataValues("colors", accessToken),
				this.getMetadataValues("brands", accessToken),
				this.getMetadataValues("shapes", accessToken),
				this.getMetadataValues("textures", accessToken),
				this.getMetadataValues("distributors", accessToken),
				this.getMetadataValues("bag_quantities", accessToken),
				this.getProductData(accessToken),
			]);

			const uniqueSizes = [
				...new Set(products.map((p) => p.size).filter(Boolean)),
			].sort();

			return {
				metadata: {
					productType: productTypes,
					color: colors,
					manufacturer: brands,
					size: uniqueSizes,
					texture: textures,
					bagQuantity: bagQuantities,
					shape: shapes,
					distributor: distributors,
					occasion: occasions,
				},
				products,
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
}
