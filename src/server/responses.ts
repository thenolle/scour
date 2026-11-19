export function jsonResponse(body: unknown, status = 200): Response {
	return Response.json(body, { status })
}

export function errorResponse(status: number, code: string, message: string): Response {
	return jsonResponse({ error: { code, message } }, status)
}
