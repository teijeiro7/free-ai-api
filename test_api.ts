const response = await fetch("http://localhost:3000/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    messages: [{ role: "user", content: "Hola, ¿cómo estás?" }],
  }),
});

if (!response.ok) {
  console.error("Error:", response.status, await response.text());
  process.exit(1);
}

const reader = response.body?.getReader();
if (!reader) {
  console.error("No response body");
  process.exit(1);
}

const decoder = new TextDecoder();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  process.stdout.write(decoder.decode(value));
}
console.log("\n\nTest completed successfully!");
