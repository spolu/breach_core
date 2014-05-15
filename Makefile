EXO_BROWSER = "default"

clean:
	rm -rf node_modules
	rm -rf out

install: clean
	npm install

dist_linux: install
	node dist/linux.js $(EXO_BROWSER)


.PHONY: clean install dist_linux
