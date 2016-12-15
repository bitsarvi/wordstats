# Wordstats
For Hackathon 2016

## Architecture

![Wordstats Microservices Architecture](wordstats-arch.png)

As shown in the picture above, this application is front-ended
by nginx. There are 3 NodeJS-based microservices - ui, processor
and metrics - which implement all the logic of the app. nginx
dispatches requests to each of these microservices based on the
path component of the incoming URI. A backend redis deployment 
is used to store the data that the application uses. The redis
tier deploys a master and one or more slave processes. The
master process is used by those components that need to update
data and the slave processes are used to serve readonly 
requests.

### ui
This component is responsible for rendering the initial 
web interface and for identifying each user by asking them
to register their name. 

### proc
This component is the one that actually analyzes the text
submitted by the user and updates the related statistics in
the redis master

### metrics
This component simply services requests for both per-user
stats as well as global stats.

## Authentication
A session-cookie is used to identify each user. This cookie
is created and associated with a user when they register
their name. All subsequent requests from the browser will
include this cookie and all 3 components use the cookie to
identify the user. The value stored in the cookie is a 
randomly generated string.

## Redis tables
TBD - Put info about the table schema here.

## Deployment Topology

```
$ kubectl get pods
NAME                                             READY     STATUS    RESTARTS   AGE
redis-master-f2g1v                               1/1       Running   0          10h
redis-slave-hu6oa                                1/1       Running   0          9h
redis-slave-ogkwr                                1/1       Running   0          9h
wordstats-metrics-deployment-420532911-7t6xr     1/1       Running   0          25m
wordstats-processor-deployment-120247658-rkb1f   1/1       Running   0          24m
wordstats-ui-deployment-1529072740-c4btm         1/1       Running   0          25m



$ kubectl get deployments
NAME                             DESIRED   CURRENT   UP-TO-DATE   AVAILABLE   AGE
wordstats-metrics-deployment     1         1         1            1           25m
wordstats-processor-deployment   1         1         1            1           25m
wordstats-ui-deployment          1         1         1            1           25m



$ kubectl get services
NAME                  CLUSTER-IP       EXTERNAL-IP   PORT(S)    AGE
kubernetes            10.107.240.1     <none>        443/TCP    20h
redis-master          10.107.241.80    <none>        6379/TCP   10h
redis-slave           10.107.253.193   <none>        6379/TCP   9h
wordstats-metrics     10.107.251.16    <nodes>       8080/TCP   24m
wordstats-processor   10.107.246.29    <nodes>       8080/TCP   25m
wordstats-ui          10.107.250.188   <nodes>       8080/TCP   25m

$ kubectl get ing
NAME                HOSTS     ADDRESS         PORTS     AGE
wordstats-ingress   *         35.186.192.43   80        30m



$ kubectl describe ingress wordstats-ingress
Name:           wordstats-ingress
Namespace:      default
Address:        35.186.192.43
Default backend:    wordstats-ui:8080 (10.104.1.11:8080)
Rules:
  Host  Path    Backends
  ----  ----    --------
  * 
        /stats/all  wordstats-metrics:8080 (10.104.2.11:8080)
        /stats/self     wordstats-metrics:8080 (10.104.2.11:8080)
        /upload/text    wordstats-processor:8080 (10.104.1.12:8080)
Annotations:
  backends:     {"k8s-be-31395--5ce5e4fe1318a903":"HEALTHY","k8s-be-31402--5ce5e4fe1318a903":"HEALTHY","k8s-be-31531--5ce5e4fe1318a903":"HEALTHY"}
  forwarding-rule:  k8s-fw-default-wordstats-ingress--5ce5e4fe1318a903
  target-proxy:     k8s-tp-default-wordstats-ingress--5ce5e4fe1318a903
  url-map:      k8s-um-default-wordstats-ingress--5ce5e4fe1318a903
Events:
  FirstSeen LastSeen    Count   From                SubobjectPath   Type        Reason  Message
  --------- --------    -----   ----                -------------   --------    ------  -------
  33m       33m     1   {loadbalancer-controller }          Normal      ADD default/wordstats-ingress
  31m       31m     1   {loadbalancer-controller }          Normal      CREATE  ip: 35.186.192.43

```

