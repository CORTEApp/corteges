type DataTable01Props = {
  columns: string[];
  rows: string[][];
};

export function DataTable01({ columns, rows }: DataTable01Props) {
  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} style={{ textAlign: "left", padding: "14px 16px", borderBottom: "1px solid var(--border)", background: "var(--muted)" }}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
