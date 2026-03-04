package com.smartmigrate.writers.netsuite;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * OAuth 1.0a (HMAC-SHA256) header builder for NetSuite TBA.
 *
 * Two NetSuite-specific requirements beyond plain RFC 5849:
 *
 *  1. oauth_body_hash — SHA-256 of the raw request body, Base64-encoded,
 *     included in the signed parameter set.  For GET requests (empty body)
 *     this is the SHA-256 of "".
 *     Postman confirms: oauth_body_hash="47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU="
 *
 *  2. Account ID (realm) uses underscore separator for sandbox accounts,
 *     not the hyphen in the subdomain.
 *     URL subdomain : 3355888-sb1   →  Account ID: 3355888_SB1
 */
public class NetSuiteOAuthHelper {

    /**
     * Convenience overload for requests with no body (GET, DELETE).
     */
    public static String buildHeader(String method, String rawUrl, Map<String, Object> config)
            throws Exception {
        return buildHeader(method, rawUrl, config, "");
    }

    /**
     * Builds the full Authorization header value for a single HTTP request.
     *
     * @param method      HTTP method ("GET", "POST", …)
     * @param rawUrl      Full request URL, optionally with query string
     * @param config      Destination config: consumerKey, consumerSecret,
     *                    accessToken, tokenSecret, accountUrl
     * @param requestBody Raw request body bytes as String (pass "" for GET)
     */
    public static String buildHeader(String method, String rawUrl,
                                     Map<String, Object> config,
                                     String requestBody) throws Exception {

        // ── 1. Split URL into base URI and query string ───────────────────────
        int    qIdx      = rawUrl.indexOf('?');
        String baseUri   = qIdx >= 0 ? rawUrl.substring(0, qIdx) : rawUrl;
        String queryPart = qIdx >= 0 ? rawUrl.substring(qIdx + 1) : null;

        // ── 2. Credentials from config (strip whitespace to catch copy-paste noise)
        String consumerKey    = ((String) config.get("consumerKey")).strip();
        String consumerSecret = ((String) config.get("consumerSecret")).strip();
        String accessToken    = ((String) config.get("accessToken")).strip();
        String tokenSecret    = ((String) config.get("tokenSecret")).strip();
        String accountId      = extractAccountId((String) config.get("accountUrl"));

        String timestamp = String.valueOf(System.currentTimeMillis() / 1000);
        String nonce     = UUID.randomUUID().toString().replace("-", "");

        // ── 3. oauth_body_hash — SHA-256 of raw request body, Base64 encoded ─
        //    For GET / empty body this equals the SHA-256 of "":
        //    47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=
        String bodyHash = computeBodyHash(requestBody);

        // ── 4. Build the parameter set (TreeMap → lexicographic sort) ─────────
        TreeMap<String, String> params = new TreeMap<>();
        params.put("oauth_body_hash",        bodyHash);
        params.put("oauth_consumer_key",     consumerKey);
        params.put("oauth_nonce",            nonce);
        params.put("oauth_signature_method", "HMAC-SHA256");
        params.put("oauth_timestamp",        timestamp);
        params.put("oauth_token",            accessToken);
        params.put("oauth_version",          "1.0");

        // Merge any query-string params into the parameter set for signing
        if (queryPart != null && !queryPart.isBlank()) {
            for (String pair : queryPart.split("&")) {
                String[] kv = pair.split("=", 2);
                String k = URLDecoder.decode(kv[0], StandardCharsets.UTF_8);
                String v = kv.length > 1 ? URLDecoder.decode(kv[1], StandardCharsets.UTF_8) : "";
                params.put(k, v);
            }
        }

        // ── 5. Normalized parameter string ───────────────────────────────────
        String paramString = params.entrySet().stream()
                .map(e -> pct(e.getKey()) + "=" + pct(e.getValue()))
                .collect(Collectors.joining("&"));

        // ── 6. Signature base string ──────────────────────────────────────────
        String baseString = method.toUpperCase()
                + "&" + pct(baseUri)
                + "&" + pct(paramString);

        // ── 7. Signing key ────────────────────────────────────────────────────
        String signingKey = pct(consumerSecret) + "&" + pct(tokenSecret);

        // ── DEBUG logging ─────────────────────────────────────────────────────
        System.out.println("[NetSuiteOAuth] ===== OAuth Signature Debug =====");
        System.out.println("[NetSuiteOAuth]   method          : " + method.toUpperCase());
        System.out.println("[NetSuiteOAuth]   baseUri         : " + baseUri);
        System.out.println("[NetSuiteOAuth]   queryPart       : " + queryPart);
        System.out.println("[NetSuiteOAuth]   accountId(realm): " + accountId);
        System.out.println("[NetSuiteOAuth]   consumerKey     : " + mask(consumerKey));
        System.out.println("[NetSuiteOAuth]   accessToken     : " + mask(accessToken));
        System.out.println("[NetSuiteOAuth]   bodyHash        : " + bodyHash);
        System.out.println("[NetSuiteOAuth]   timestamp       : " + timestamp);
        System.out.println("[NetSuiteOAuth]   paramString     : " + paramString);
        System.out.println("[NetSuiteOAuth]   baseString      : " + baseString);

        // ── 8. HMAC-SHA256 ────────────────────────────────────────────────────
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(signingKey.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        String signature = Base64.getEncoder().encodeToString(
                mac.doFinal(baseString.getBytes(StandardCharsets.UTF_8)));

        System.out.println("[NetSuiteOAuth]   signature(b64)  : " + signature);
        System.out.println("[NetSuiteOAuth] ===================================");

        // ── 9. Authorization header ───────────────────────────────────────────
        return "OAuth realm=\"" + accountId + "\""
                + ",oauth_consumer_key=\"" + consumerKey + "\""
                + ",oauth_token=\"" + accessToken + "\""
                + ",oauth_signature_method=\"HMAC-SHA256\""
                + ",oauth_timestamp=\"" + timestamp + "\""
                + ",oauth_nonce=\"" + nonce + "\""
                + ",oauth_version=\"1.0\""
                + ",oauth_body_hash=\"" + pct(bodyHash) + "\""
                + ",oauth_signature=\"" + pct(signature) + "\"";
    }

    /**
     * Extracts and normalises the NetSuite account ID from the base URL.
     *
     * URL subdomain uses hyphens;  NetSuite Account ID uses underscores:
     *   https://3355888-sb1.suitetalk.api.netsuite.com  →  3355888_SB1
     *   https://1234567.suitetalk.api.netsuite.com      →  1234567
     */
    public static String extractAccountId(String accountUrl) {
        String host      = accountUrl.strip().replaceFirst("https?://", "");
        String subdomain = host.split("\\.")[0];
        // Uppercase + replace hyphen with underscore (sandbox separator)
        return subdomain.toUpperCase().replace("-", "_");
    }

    /** SHA-256 of the raw request body, Base64-encoded. */
    private static String computeBodyHash(String body) throws Exception {
        MessageDigest sha256 = MessageDigest.getInstance("SHA-256");
        byte[] hash = sha256.digest(
                (body != null ? body : "").getBytes(StandardCharsets.UTF_8));
        return Base64.getEncoder().encodeToString(hash);
    }

    private static String mask(String v) {
        if (v == null || v.length() <= 8) return "***";
        return v.substring(0, 4) + "..." + v.substring(v.length() - 4);
    }

    /** RFC 3986 percent-encoding — spaces become %20, not +. */
    static String pct(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8)
                .replace("+",   "%20")
                .replace("*",   "%2A")
                .replace("%7E", "~");
    }
}
