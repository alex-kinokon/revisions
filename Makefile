src/__tests__/fixtures/wikipedia-article.generated.json:
	./scripts/fetch-wikipedia.ts > $@

src/__tests__/fixtures/japan-passport-1.generated.png:
	wget https://upload.wikimedia.org/wikipedia/commons/0/0a/JapanpassportNew10y.PNG -O $@

src/__tests__/fixtures/japan-passport-2.generated.png:
	wget https://upload.wikimedia.org/wikipedia/commons/archive/0/0a/20110119163334%21JapanpassportNew10y.PNG -O $@

src/__tests__/fixtures/japan-passport-3.generated.png:
	wget https://upload.wikimedia.org/wikipedia/commons/archive/0/0a/20110112050424%21JapanpassportNew10y.PNG -O $@

src/__tests__/fixtures/japan-passport-4.generated.png:
	wget https://upload.wikimedia.org/wikipedia/commons/archive/0/0a/20070318080405%21JapanpassportNew10y.PNG -O $@

all: src/__tests__/fixtures/wikipedia-article.generated.json \
  src/__tests__/fixtures/japan-passport-1.generated.png \
	src/__tests__/fixtures/japan-passport-2.generated.png \
	src/__tests__/fixtures/japan-passport-3.generated.png \
	src/__tests__/fixtures/japan-passport-4.generated.png
