import { handleOperationsBrief } from '../server/operationsBrief.ts'
export default { fetch: (request: Request) => handleOperationsBrief(request) }
