using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using Newtonsoft.Json.Linq;

namespace AdnmbBackup_webapi
{
    public static class BackupUtils
    {
        // Add method to get API base URL
        public static string GetApiBaseUrl()
        {
            if (File.Exists("proxy.txt"))
            {
                string url = File.ReadAllText("proxy.txt").Trim();
                // Make sure the URL doesn't end with a slash
                return url.TrimEnd('/');
            }
            return "https://api.nmb.best";
        }

        // Add method to get the domain from a URL
        public static string GetDomainFromUrl(string url)
        {
            try
            {
                Uri uri = new Uri(url);
                return uri.Host;
            }
            catch
            {
                return "api.nmb.best"; // Fallback to default
            }
        }

        // Add method to get the image URL base
        public static string GetImageBaseUrl()
        {
            return "https://image.nmb.best/image";
        }

        public static string ReadGzip(byte[] bytes)
        {
            string result = string.Empty;
            using (MemoryStream ms = new MemoryStream(bytes))
            {
                using (GZipStream decompressedStream = new GZipStream(ms, CompressionMode.Decompress))
                {
                    using (StreamReader sr = new StreamReader(decompressedStream, Encoding.UTF8))
                    {
                        result = sr.ReadToEnd();
                    }
                }
            }
            return result;
        }

        public static string ContentProcess(string content)
        {
            return content.Replace("<font color=\"#789922\">>>&gt;", ">>").Replace("</font><br />", Environment.NewLine)
                .Replace("</font>", Environment.NewLine)
                .Replace("<br />\r\n", Environment.NewLine).Replace("<br />\n", Environment.NewLine);
        }

        public static string GenerateSavepath(string id, string title, string ext, bool isPoOnly)
        {
            string suffix = isPoOnly ? "_po_only" : "";
            if (title != "无标题")
            {
                string filename = title;
                string invalidChars = new string(Path.GetInvalidFileNameChars()) + new string(Path.GetInvalidPathChars());
                foreach (char c in invalidChars)
                {
                    filename = filename.Replace(c.ToString(), "_");
                }
                if (filename.Length > 100)
                {
                    filename = filename.Substring(0, 100);
                }
                return Path.Combine("output", id + "_" + filename + suffix + ext);
            }
            else
            {
                return Path.Combine("output", id + suffix + ext);
            }
        }
    }
}
