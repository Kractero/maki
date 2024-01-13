const apiParameters = ["page", "responseFormat", "limit"]
const validParameters = ["buyer", "seller", "cardid", "category", "minprice", "maxprice", "price", "season", "beforetime", "sincetime"]

export function parse(params, limit, page) {
  const keys = Object.keys(params)
  const queryParams = [];
  const sqlConditions = [];
  const categories = ["common", "uncommon", "rare", "ultra-rare", "epic", "legendary"]
  keys.forEach(param => {
    if (!validParameters.includes(param) && !apiParameters.includes(param)) {
      throw new Error("Invalid parameter " + param)
    }

    if (!apiParameters.includes(param) && params[param]) {
      let paramValue = params[param]
      if (param === "category") {
        if (categories.includes(params["category"].toLowerCase().replace(' ', '-'))) {
          paramValue = params["category"].toLowerCase().replace(' ', '-') === "ultra-rare" ? "ur" : params["category"][0]
          sqlConditions.push(`category COLLATE NOCASE = (?)`);
        }
      } else if (param === "minprice") {
        sqlConditions.push(`price >= (?)`);
      } else if (param === "maxprice") {
        sqlConditions.push(`price <= (?)`);
      } else if (param === "beforetime") {
        const dateObject = new Date(params.beforetime);
        paramValue = Math.floor(dateObject.getTime()/1000).toString();
        sqlConditions.push(`timestamp > (?)`);
      } else if (param === "sincetime") {
        const dateObject = new Date(params.sincetime);
        paramValue = Math.floor(dateObject.getTime()/1000).toString();
        sqlConditions.push(`timestamp < (?)`);
      } else {
        sqlConditions.push(`${param === "cardid" ? "card_id" : param} COLLATE NOCASE = (?)`);
      }
      if (param === "seller" || param === "buyer") {
        paramValue = paramValue.replace(' ', '_')
      }

      let sqlQuery = 'SELECT * FROM trades';
      if (sqlConditions.length > 0) {
        sqlQuery += ` WHERE ${sqlConditions.join(' AND ')}`;
      }
      sqlQuery += ' ORDER BY timestamp DESC';
      if (paramValue.toLowerCase() !== "all") queryParams.push(paramValue);
    }
  })
  let sqlQuery = 'SELECT * FROM trades';
  if (sqlConditions.length > 0) {
    sqlQuery += ` WHERE ${sqlConditions.join(' AND ')}`;
  }
  sqlQuery += ' ORDER BY timestamp DESC';
  limit = limit ? parseInt(limit) : 1000;

  const limitSqlQuery = sqlQuery + ` LIMIT ${limit} OFFSET ${(page-1) * limit}`;

  return [limitSqlQuery, queryParams, sqlQuery]
}