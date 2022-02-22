#!/bin/bash

gcloud functions deploy guess_the_dj__play --entry-point play --runtime nodejs16 --trigger-http --allow-unauthenticated &&
gcloud functions deploy guess_the_dj__submit --entry-point submit --runtime nodejs16 --trigger-http --allow-unauthenticated &&
gcloud functions deploy guess_the_dj__guess --entry-point guess --runtime nodejs16 --trigger-http --allow-unauthenticated &&
gcloud functions deploy guess_the_dj__reveal --entry-point reveal --runtime nodejs16 --trigger-http --allow-unauthenticated
