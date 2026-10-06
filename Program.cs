using WordtGame;

var builder = WebApplication.CreateBuilder(args);

// Disable any HTTPS requirements in Kestrel
builder.WebHost.ConfigureKestrel(options =>
{
    options.ListenAnyIP(5000); // Force listen on http://0.0.0.0:5000
});

builder.Services.AddSignalR();

var app = builder.Build();

// Enable serving wwwroot/index.html
app.UseDefaultFiles();
app.UseStaticFiles();
app.UseRouting();

app.MapHub<GameHub>("/gamehub");

app.MapGet("/qrcode", (HttpContext context) =>
{
    string hostIp = GetLocalIpAddress();
    string joinUrl = $"http://{hostIp}:5000";

    using QRCoder.QRCodeGenerator qrGenerator = new QRCoder.QRCodeGenerator();
    using QRCoder.QRCodeData qrCodeData = qrGenerator.CreateQrCode(joinUrl, QRCoder.QRCodeGenerator.ECCLevel.Q);
    using QRCoder.PngByteQRCode qrCode = new QRCoder.PngByteQRCode(qrCodeData);
    byte[] qrCodeAsPngByteGraphic = qrCode.GetGraphic(20);

    return Results.Bytes(qrCodeAsPngByteGraphic, "image/png");
});

app.MapGet("/localip", () => GetLocalIpAddress());

app.Run();

static string GetLocalIpAddress()
{
    try
    {
        var host = System.Net.Dns.GetHostEntry(System.Net.Dns.GetHostName());
        foreach (var ip in host.AddressList)
        {
            if (ip.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork && !System.Net.IPAddress.IsLoopback(ip))
            {
                return ip.ToString();
            }
        }
    }
    catch { }
    return "127.0.0.1";
}
