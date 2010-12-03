test:
	python -m SimpleHTTPServer &
	python -c 'import webbrowser; webbrowser.open("http://localhost:8000/tests/qUnit/qUnit.html")'
	
