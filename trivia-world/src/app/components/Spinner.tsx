/**
 * Renders a circular loading indicator styled with the app's theme colors.
 * @returns A spinner element to communicate in-progress operations.
 */
export default function Spinner() {
    return <div className="border-4 border-slate-500 border-t-primary rounded-full w-8 h-8 animate-spin"></div>;
}
