import { handleOperationsBrief } from '../server/operationsBrief.js'
export default { fetch: (request: Request) => handleOperationsBrief(request) }
