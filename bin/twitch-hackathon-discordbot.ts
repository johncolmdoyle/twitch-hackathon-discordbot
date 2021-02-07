#!/usr/bin/env node
import * as cdk from '@aws-cdk/core';
import { TwitchHackathonDiscordbotStack } from '../lib/twitch-hackathon-discordbot-stack';

const app = new cdk.App();
new TwitchHackathonDiscordbotStack(app, 'TwitchHackathonDiscordbotStack');
cdk.Tags.of(app).add("app", "twitch-hackathon");
