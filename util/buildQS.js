export function buildQS(reqs) {
  return Object.keys(reqs).map(key => {
    if (reqs[key] && key !== "page") {
      return `${encodeURIComponent(key)}=${encodeURIComponent(reqs[key])}`
    }
  }).filter(param => param).join('&')
}