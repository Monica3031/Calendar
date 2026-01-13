const sql = require('mssql');
const axios = require('axios');

module.exports = async function (context, req) {
    // Fetch token from IMDS
    const tokenResponse = await axios.get(
        "http://169.254.169.254/metadata/identity/oauth2/token",
        {
            params: { resource: "https://database.windows.net/" },
            headers: { Metadata: "true" }
        }
    );

    const token = tokenResponse.data.access_token;

    // Connect to SQL using token
    const pool = await sql.connect({
        server: "moniakserver.database.windows.net",
        database: "moniaktest",
        options: { encrypt: true },
        authentication: {
            type: "azure-active-directory-access-token",
            options: { token }
        }
    });

    // Example query
    const result = await pool.request().query("SELECT TOP 10 * FROM Users");

    context.res = {
        status: 200,
        body: result.recordset
    };
};
