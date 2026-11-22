package com.chronos.core.web;

import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.resource.PathResourceResolver;

import java.io.IOException;
import java.time.Duration;

/**
 * Serves the built web app (copied to {@code classpath:/static/} by the Docker build) from the same
 * origin as the API, so the session cookie works without CORS. Client-side routes such as
 * {@code /month} fall back to {@code index.html}; {@code /api/**} and missing files stay 404.
 */
@Configuration
public class SpaWebConfig implements WebMvcConfigurer {

    private static final String LOCATION = "classpath:/static/";

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // Vite fingerprints everything under /assets, so it can be cached forever.
        registry.addResourceHandler("/assets/**")
                .addResourceLocations(LOCATION + "assets/")
                .setCacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable());

        registry.addResourceHandler("/**")
                .addResourceLocations(LOCATION)
                .setCacheControl(CacheControl.noCache())
                .resourceChain(false)
                .addResolver(new SpaFallbackResolver());
    }

    static class SpaFallbackResolver extends PathResourceResolver {
        @Override
        protected Resource getResource(String path, Resource location) throws IOException {
            Resource resource = location.createRelative(path);
            if (resource.exists() && resource.isReadable()) {
                return resource;
            }
            String lastSegment = path.substring(path.lastIndexOf('/') + 1);
            if (path.startsWith("api/") || lastSegment.contains(".")) {
                return null;
            }
            Resource index = location.createRelative("index.html");
            return index.exists() ? index : null;
        }
    }
}
