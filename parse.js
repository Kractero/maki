const apiParameters = ["page", "responseFormat", "limit"]
const validParameters = ["buyer", "cardid", "category", "minprice", "maxprice", "price", "season", "seller", "beforetimestamp", "aftertimestamp"]

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
      console.log(param)
      let paramValue = params[param]
      if (param === "category") {
        if (categories.includes(params["category"].toLowerCase())) {
          paramValue = params["category"] === "ultra-rare" ? "ur" : params["category"][0]
          sqlConditions.push(`category COLLATE NOCASE = (?)`);
        }
      } else if (param === "minprice") {
        sqlConditions.push(`price >= (?)`);
      } else if (param === "maxprice") {
        sqlConditions.push(`price <= (?)`);
      } else if (param === "beforetimestamp") {
        sqlConditions.push(`timestamp < (?)`);
      } else if (param === "aftertimestamp") {
        sqlConditions.push(`timestamp > (?)`);
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
      queryParams.push(paramValue);
    }
  })
  let sqlQuery = 'SELECT * FROM trades';
  if (sqlConditions.length > 0) {
    sqlQuery += ` WHERE ${sqlConditions.join(' AND ')}`;
  }
  sqlQuery += ' ORDER BY timestamp DESC';
  limit = limit ? parseInt(limit) : 1000;

  sqlQuery += ` LIMIT ${limit} OFFSET ${(page-1) * limit}`;

  return [sqlQuery, queryParams]
}