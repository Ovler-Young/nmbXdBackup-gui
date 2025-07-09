
using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Net;
using Newtonsoft.Json.Linq;
using Newtonsoft.Json;
using System.Collections.Generic;
using System.Text;
using System;

namespace AdnmbBackup_webapi.Controllers
{
    [ApiController]
    [Route("api/thread")]
    public class BackupController : ControllerBase
    {
        private readonly IHttpClientFactory _httpClientFactory;

        public BackupController(IHttpClientFactory httpClientFactory)
        {
            _httpClientFactory = httpClientFactory;
        }

        [HttpGet]
        public async Task<IActionResult> Get([FromQuery] string id)
        {
            if (string.IsNullOrEmpty(id) || !id.All(char.IsDigit))
            {
                return BadRequest("Invalid ID");
            }

            if (!System.IO.File.Exists("cookie.txt"))
            {
                return BadRequest("cookie.txt not found");
            }

            try
            {
                string path = Path.Combine("cache", id + ".json");
                string po = Path.Combine("po", id + ".txt");

                if (System.IO.File.Exists(path))
                {
                    var joInCache = JsonConvert.DeserializeObject<JObject>(System.IO.File.ReadAllText(path));
                    var replyCountInCache = joInCache["ReplyCount"].Value<int>();
                    int pageCountInCache = replyCountInCache / 19;
                    if (replyCountInCache % 19 != 0) pageCountInCache++;

                    JArray contentJA = (JArray)joInCache["Replies"];
                    for (int i = 0; i < contentJA.Count; i++)
                    {
                        if (i >= (pageCountInCache - 1) * 19)
                        {
                            contentJA.RemoveAt(i);
                            i--;
                        }
                    }

                    string url = BackupUtils.GetApiBaseUrl() + "/Api/thread";
                    var cookie = System.IO.File.ReadAllText("cookie.txt");
                    var cookieContainer = new CookieContainer();
                    string domain = BackupUtils.GetDomainFromUrl(BackupUtils.GetApiBaseUrl());
                    cookieContainer.Add(new Cookie("userhash", cookie, "/", domain));
                    var handler = new HttpClientHandler() { UseCookies = true, CookieContainer = cookieContainer };
                    var http = _httpClientFactory.CreateClient();
                    http.DefaultRequestHeaders.Add("Host", domain);
                    http.DefaultRequestHeaders.Add("Accept", "application/json");
                    http.DefaultRequestHeaders.Add("Accept-Encoding", "gzip");
                    http.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.0.0 Safari/537.36");

                    var response = await http.GetAsync(url + "?id=" + id + "&page=1");
                    var bytes = await response.Content.ReadAsByteArrayAsync();
                    string str = BackupUtils.ReadGzip(bytes);
                    var fpjson = JsonConvert.DeserializeObject<JObject>(str);

                    if (fpjson.ContainsKey("success"))
                    {
                        var errMessage = fpjson["error"].ToString();
                        return BadRequest($"Backup {id} failed. {errMessage}");
                    }

                    var replyCount = int.Parse(fpjson["ReplyCount"].ToString());
                    int pageCount = replyCount / 19;
                    if (replyCount % 19 != 0) pageCount++;

                    if (pageCount >= pageCountInCache)
                    {
                        JArray additionalReplies = await FetchPagesInParallelAsync(http, url, id, pageCountInCache, pageCount);
                        foreach (var item in additionalReplies)
                        {
                            contentJA.Add(item);
                        }
                    }

                    fpjson["Replies"].Replace(contentJA);
                    var fjsonstr = JsonConvert.SerializeObject(fpjson, Formatting.Indented);
                    System.IO.File.WriteAllText(path, fjsonstr);
                }
                else
                {
                    string url = BackupUtils.GetApiBaseUrl() + "/Api/thread";
                    var cookie = System.IO.File.ReadAllText("cookie.txt");
                    var cookieContainer = new CookieContainer();
                    string domain = BackupUtils.GetDomainFromUrl(BackupUtils.GetApiBaseUrl());
                    cookieContainer.Add(new Cookie("userhash", cookie, "/", domain));
                    var handler = new HttpClientHandler() { UseCookies = true, CookieContainer = cookieContainer };
                    var http = _httpClientFactory.CreateClient();
                    http.DefaultRequestHeaders.Add("Host", domain);
                    http.DefaultRequestHeaders.Add("Accept", "application/json");
                    http.DefaultRequestHeaders.Add("Accept-Encoding", "gzip");
                    http.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.0.0 Safari/537.36");

                    var response = await http.GetAsync(url + "?id=" + id + "&page=1");
                    var bytes = await response.Content.ReadAsByteArrayAsync();
                    string str = BackupUtils.ReadGzip(bytes);

                    if (str == "\u8be5\u4e32\u4e0d\u5b58\u5728")
                    {
                        return NotFound($"Thread {id} not found.");
                    }

                    var fpjson = JsonConvert.DeserializeObject<JObject>(str);

                    if (fpjson.ContainsKey("success"))
                    {
                        var errMessage = fpjson["error"].ToString();
                        return BadRequest($"Backup {id} failed. {errMessage}");
                    }

                    var replyCount = int.Parse(fpjson["ReplyCount"].ToString());
                    int pageCount = replyCount / 19;
                    if (replyCount % 19 != 0) pageCount++;

                    JArray contentJA = fpjson["Replies"].ToObject<JArray>();
                    if (pageCount > 1)
                    {
                        JArray additionalReplies = await FetchPagesInParallelAsync(http, url, id, 2, pageCount);
                        foreach (var item in additionalReplies)
                        {
                            contentJA.Add(item);
                        }
                    }

                    fpjson["Replies"].Replace(contentJA);
                    var fjsonstr = JsonConvert.SerializeObject(fpjson, Formatting.Indented);
                    System.IO.File.WriteAllText(path, fjsonstr);
                }

                ConvertToText(id);
                ConvertToTextPoOnly(id);
                ConvertToMarkdown(id);
                ConvertToMarkdownPoOnly(id);

                return Ok($"Backup for {id} completed successfully.");
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"An error occurred: {ex.Message}");
            }
        }

        private async Task<JArray> FetchPagesInParallelAsync(HttpClient http, string url, string id, int startPage, int endPage)
        {
            JArray resultArray = new JArray();
            var tasks = new List<Task<Tuple<int, JArray>>>();
            for (int page = startPage; page <= endPage; page++)
            {
                int pageNumber = page;
                tasks.Add(FetchPageAsync(http, url, id, pageNumber));
            }
            var results = await Task.WhenAll(tasks);
            foreach (var result in results.OrderBy(r => r.Item1))
            {
                foreach (var item in result.Item2)
                {
                    if (item["user_hash"].ToString() == "Tips") continue;
                    resultArray.Add(item);
                }
            }
            return resultArray;
        }

        private async Task<Tuple<int, JArray>> FetchPageAsync(HttpClient http, string url, string id, int page)
        {
            try
            {
                var response = await http.GetAsync(url + "?id=" + id + "&page=" + page);
                var bytes = await response.Content.ReadAsByteArrayAsync();
                string str = BackupUtils.ReadGzip(bytes);
                var jo = JsonConvert.DeserializeObject<JObject>(str);
                JArray ja = jo["Replies"].ToObject<JArray>();
                return Tuple.Create(page, ja);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error fetching page {page}: {ex.Message}");
                return Tuple.Create(page, new JArray());
            }
        }

        private void ConvertToText(string id)
        {
            string path = Path.Combine("cache", id + ".json");
            var jo = JsonConvert.DeserializeObject<JObject>(System.IO.File.ReadAllText(path));
            var sb = new StringBuilder();
            sb.Append(jo["user_hash"].ToString()); sb.Append("  "); sb.Append(jo["now"].ToString());
            sb.Append("  No."); sb.Append(jo["id"].ToString()); sb.Append(Environment.NewLine);
            var savepath = BackupUtils.GenerateSavepath(id, jo["title"].ToString(), ".txt", false);
            if (jo["title"].ToString() != "无标题")
            {
                sb.Append("标题:"); sb.Append(jo["title"].ToString()); sb.Append(Environment.NewLine);
            }
            sb.Append(BackupUtils.ContentProcess(jo["content"].ToString())); sb.Append(Environment.NewLine);
            var ja = jo["Replies"].ToObject<JArray>();
            for (int i = 0; i < ja.Count; i++)
            {
                sb.Append("------------------------------------"); sb.Append(Environment.NewLine);
                sb.Append(ja[i]["user_hash"].ToString()); sb.Append("  "); sb.Append(ja[i]["now"].ToString());
                sb.Append("  No."); sb.Append(ja[i]["id"].ToString()); sb.Append(Environment.NewLine);
                sb.Append(BackupUtils.ContentProcess(ja[i]["content"].ToString())); sb.Append(Environment.NewLine);
            }
            System.IO.File.WriteAllText(savepath, sb.ToString(), System.Text.Encoding.GetEncoding("UTF-8"));
        }

        private void ConvertToTextPoOnly(string id)
        {
            string path = Path.Combine("cache", id + ".json");
            var po_path = path.Replace("cache", "po").Replace("json", "txt");
            var jo = JsonConvert.DeserializeObject<JObject>(System.IO.File.ReadAllText(path));
            var sb = new StringBuilder();
            sb.Append(jo["user_hash"].ToString()); sb.Append("  "); sb.Append(jo["now"].ToString());
            sb.Append("  No."); sb.Append(jo["id"].ToString()); sb.Append(Environment.NewLine);
            var savepath = BackupUtils.GenerateSavepath(id, jo["title"].ToString(), ".txt", true);
            if (jo["title"].ToString() != "无标题")
            {
                sb.Append("标题:"); sb.Append(jo["title"].ToString()); sb.Append(Environment.NewLine);
            }
            sb.Append(BackupUtils.ContentProcess(jo["content"].ToString())); sb.Append(Environment.NewLine);
            var ja = jo["Replies"].ToObject<JArray>();
            var poid = new HashSet<string>();
            poid.Add(jo["user_hash"].ToString());
            if (System.IO.File.Exists(po_path) && System.IO.File.ReadAllText(po_path) != "")
            {
                var lines = System.IO.File.ReadAllLines(po_path);
                foreach (var line in lines)
                {
                    poid.Add(line.Split(' ')[0]);
                }
            }
            for (int i = 0; i < ja.Count; i++)
            {
                if (poid.Contains(ja[i]["user_hash"].ToString()))
                {
                    sb.Append("------------------------------------"); sb.Append(Environment.NewLine);
                    sb.Append(ja[i]["user_hash"].ToString()); sb.Append("  "); sb.Append(ja[i]["now"].ToString());
                    sb.Append("No."); sb.Append(ja[i]["id"].ToString()); sb.Append(Environment.NewLine);
                    sb.Append(BackupUtils.ContentProcess(ja[i]["content"].ToString())); sb.Append(Environment.NewLine);
                }
            }
            System.IO.File.WriteAllText(savepath, sb.ToString(), System.Text.Encoding.GetEncoding("UTF-8"));
        }

        private void ConvertToMarkdown(string id)
        {
            string path = Path.Combine("cache", id + ".json");
            var po_path = path.Replace("cache", "po").Replace("json", "txt");
            var jo = JsonConvert.DeserializeObject<JObject>(System.IO.File.ReadAllText(path));
            var sb = new StringBuilder();
            var savepath = BackupUtils.GenerateSavepath(id, jo["title"].ToString(), ".md", false);
            if (jo["title"].ToString() != "无标题")
            {
                sb.Append("# "); sb.Append(jo["title"].ToString()); sb.Append(Environment.NewLine); sb.Append(Environment.NewLine);
            }
            else
            {
                sb.Append("# "); sb.Append(jo["id"].ToString()); sb.Append(Environment.NewLine); sb.Append(Environment.NewLine);
            }
            if (jo["name"].ToString() != "无名氏" && jo["name"].ToString() != "")
            {
                sb.Append("**"); sb.Append(jo["name"].ToString()); sb.Append("**"); sb.Append(Environment.NewLine);
            }
            sb.Append("No."); sb.Append(jo["id"].ToString()); sb.Append("  "); sb.Append(jo["user_hash"].ToString()); sb.Append("  "); sb.Append(jo["now"].ToString()); sb.Append(Environment.NewLine);
            if (jo["img"].ToString() != "")
            {
                string imageBaseUrl = BackupUtils.GetImageBaseUrl();
                sb.Append("![image]("); sb.Append(imageBaseUrl); sb.Append("/");
                sb.Append(jo["img"].ToString()); sb.Append(jo["ext"].ToString()); sb.Append(")"); sb.Append(Environment.NewLine);
            }
            sb.Append(BackupUtils.ContentProcess(jo["content"].ToString().Replace("<b>", "**").Replace("</b>", "**").Replace("<small>", "`").Replace("</small>", "`"))); sb.Append(Environment.NewLine);
            var ja = jo["Replies"].ToObject<JArray>();
            var poid = new HashSet<string>();
            poid.Add(jo["user_hash"].ToString());
            if (System.IO.File.Exists(po_path) && System.IO.File.ReadAllText(po_path) != "")
            {
                var lines = System.IO.File.ReadAllLines(po_path);
                foreach (var line in lines)
                {
                    poid.Add(line.Split(' ')[0]);
                }
            }
            for (int i = 0; i < ja.Count; i++)
            {
                if (poid.Contains(ja[i]["user_hash"].ToString()))
                {
                    if (ja[i]["title"].ToString() != "无标题")
                    {
                        sb.Append(Environment.NewLine); sb.Append("## "); sb.Append(ja[i]["title"].ToString()); sb.Append(Environment.NewLine); sb.Append(Environment.NewLine);
                    }
                    else
                    {
                        sb.Append(Environment.NewLine); sb.Append("## No."); sb.Append(ja[i]["id"].ToString()); sb.Append(Environment.NewLine); sb.Append(Environment.NewLine);
                    }
                }
                else
                {
                    if (ja[i]["title"].ToString() != "无标题")
                    {
                        sb.Append(Environment.NewLine); sb.Append("### "); sb.Append(ja[i]["title"].ToString()); sb.Append(Environment.NewLine); sb.Append(Environment.NewLine);
                    }
                    else
                    {
                        sb.Append(Environment.NewLine); sb.Append("### No."); sb.Append(ja[i]["id"].ToString()); sb.Append(Environment.NewLine); sb.Append(Environment.NewLine);
                    }
                }
                if (ja[i]["name"].ToString() != "无名氏" && ja[i]["name"].ToString() != "")
                {
                    sb.Append("**"); sb.Append(ja[i]["name"].ToString()); sb.Append("**"); sb.Append(Environment.NewLine);
                }
                sb.Append("No."); sb.Append(ja[i]["id"].ToString()); sb.Append("  "); sb.Append(ja[i]["user_hash"].ToString()); sb.Append("  "); sb.Append(ja[i]["now"].ToString()); sb.Append(Environment.NewLine);
                if (ja[i]["img"].ToString() != "")
                {
                    string imageBaseUrl = BackupUtils.GetImageBaseUrl();
                    sb.Append("![image]("); sb.Append(imageBaseUrl); sb.Append("/");
                    sb.Append(ja[i]["img"].ToString()); sb.Append(ja[i]["ext"].ToString()); sb.Append(")"); sb.Append(Environment.NewLine);
                }
                sb.Append(BackupUtils.ContentProcess(ja[i]["content"].ToString().Replace("<b>", "**").Replace("</b>", "**").Replace("<small>", "`").Replace("</small>", "`"))); sb.Append(Environment.NewLine);
            }
            System.IO.File.WriteAllText(savepath, sb.ToString(), System.Text.Encoding.GetEncoding("UTF-8"));
        }

        private void ConvertToMarkdownPoOnly(string id)
        {
            string path = Path.Combine("cache", id + ".json");
            var po_path = path.Replace("cache", "po").Replace("json", "txt");
            var jo = JsonConvert.DeserializeObject<JObject>(System.IO.File.ReadAllText(path));
            var sb = new StringBuilder();
            var savepath = BackupUtils.GenerateSavepath(id, jo["title"].ToString(), ".md", true);
            if (jo["title"].ToString() != "无标题")
            {
                sb.Append(Environment.NewLine); sb.Append("# "); sb.Append(jo["title"].ToString()); sb.Append(Environment.NewLine); sb.Append(Environment.NewLine);
            }
            else
            {
                sb.Append(Environment.NewLine); sb.Append("# "); sb.Append(jo["id"].ToString()); sb.Append(Environment.NewLine); sb.Append(Environment.NewLine);
            }
            if (jo["name"].ToString() != "无名氏" && jo["name"].ToString() != "")
            {
                sb.Append("**"); sb.Append(jo["name"].ToString()); sb.Append("**"); sb.Append(Environment.NewLine);
            }
            sb.Append("No."); sb.Append(jo["id"].ToString()); sb.Append("  "); sb.Append(jo["user_hash"].ToString()); sb.Append("  "); sb.Append(jo["now"].ToString()); sb.Append(Environment.NewLine);
            if (jo["img"].ToString() != "")
            {
                string imageBaseUrl = BackupUtils.GetImageBaseUrl();
                sb.Append("![image]("); sb.Append(imageBaseUrl); sb.Append("/");
                sb.Append(jo["img"].ToString()); sb.Append(jo["ext"].ToString()); sb.Append(")"); sb.Append(Environment.NewLine);
            }
            sb.Append(BackupUtils.ContentProcess(jo["content"].ToString().Replace("<b>", "**").Replace("</b>", "**").Replace("<small>", "`").Replace("</small>", "`"))); sb.Append(Environment.NewLine);
            var ja = jo["Replies"].ToObject<JArray>();
            var poid = new HashSet<string>();
            poid.Add(jo["user_hash"].ToString());
            if (System.IO.File.Exists(po_path) && System.IO.File.ReadAllText(po_path) != "")
            {
                var lines = System.IO.File.ReadAllLines(po_path);
                foreach (var line in lines)
                {
                    poid.Add(line.Split(' ')[0]);
                }
            }
            for (int i = 0; i < ja.Count; i++)
            {
                if (poid.Contains(ja[i]["user_hash"].ToString()))
                {
                    if (ja[i]["title"].ToString() != "无标题")
                    {
                        sb.Append(Environment.NewLine); sb.Append("## "); sb.Append(ja[i]["title"].ToString()); sb.Append(Environment.NewLine); sb.Append(Environment.NewLine);
                    }
                    else
                    {
                        sb.Append(Environment.NewLine); sb.Append("## No."); sb.Append(ja[i]["id"].ToString()); sb.Append(Environment.NewLine); sb.Append(Environment.NewLine);
                    }
                    if (ja[i]["name"].ToString() != "无名氏" && ja[i]["name"].ToString() != "")
                    {
                        sb.Append("**"); sb.Append(ja[i]["name"].ToString()); sb.Append("**"); sb.Append(Environment.NewLine);
                    }
                    sb.Append(ja[i]["user_hash"].ToString()); sb.Append("  "); sb.Append(ja[i]["now"].ToString());
                    sb.Append("  No."); sb.Append(ja[i]["id"].ToString()); sb.Append(Environment.NewLine);
                    if (ja[i]["img"].ToString() != "")
                    {
                        string imageBaseUrl = BackupUtils.GetImageBaseUrl();
                        sb.Append("![image]("); sb.Append(imageBaseUrl); sb.Append("/");
                        sb.Append(ja[i]["img"].ToString()); sb.Append(ja[i]["ext"].ToString()); sb.Append(")"); sb.Append(Environment.NewLine);
                    }
                    sb.Append(BackupUtils.ContentProcess(ja[i]["content"].ToString().Replace("<b>", "**").Replace("</b>", "**").Replace("<small>", "`").Replace("</small>", "`"))); sb.Append(Environment.NewLine);
                }
            }
            System.IO.File.WriteAllText(savepath, sb.ToString(), System.Text.Encoding.GetEncoding("UTF-8"));
        }
    }
}
