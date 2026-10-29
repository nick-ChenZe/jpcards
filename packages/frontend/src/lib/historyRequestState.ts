/** Ignore results and errors from another date or page while the new request is pending. */
export function historyRequestState<T extends {day: string; page: number;}> (
    day: string,
    page: number,
    data: T | null,
    error: {key: string; message: string;} | null,
    pending: boolean
): {data: T | null; error: string; loading: boolean;} {
    const currentData = data?.day === day && data.page === page ? data : null;
    const currentError = error?.key === `${day}:${page}` ? error.message : '';
    return {data: currentData, error: currentError, loading: pending || (!currentData && !currentError)};
}
