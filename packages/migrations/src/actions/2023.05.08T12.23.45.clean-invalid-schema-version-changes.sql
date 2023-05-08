DELETE 
FROM
  "public"."schema_version_changes" "svc"
WHERE 
  "svc"."change_type" = 'REGISTRY_SERVICE_URL_CHANGED'
  AND (
    NOT "svc"."meta"->'serviceUrls' ? 'new'
    OR NOT "svc"."meta"->'serviceUrls' ? 'old'
  )
;
