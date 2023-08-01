using DSharpPlus.VoiceNext;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace VolfbotServices
{
	public class AudioStream
	{
		private List<byte[]> _buffer = new List<byte[]>();
		private Stream _stream = new MemoryStream();
		private VoiceTransmitSink _transmit;
		private string _streamUrl;
		float _duration;
		const int bufferSize = 1024 * 10;

		public AudioStream(string streamUrl, VoiceTransmitSink transmit, float duration)
		{
			_transmit = transmit;
			_streamUrl = streamUrl;
			_duration = duration;
		}

		public async Task PlayStream()
		{
			_ = Task.Factory.StartNew(async () => { await BufferStream(); });

			if (_stream.CanRead)
			{
				while (_buffer.Count < bufferSize && _stream.CanRead)
				{
					Thread.Sleep(50);
				}

				while (_buffer.Count > 0 || _stream.CanRead)
				{
					if (_buffer.Count > 0)
					{
						byte[] byteStream = _buffer.First();
						await _transmit.WriteAsync(byteStream);
						_buffer.RemoveAt(0);
					}
				}

			}
		}

		private async Task BufferStream()
		{
			var ffmpeg = Process.Start(new ProcessStartInfo
			{
				FileName = "ffmpeg",
				Arguments = $@"-fflags +discardcorrupt -i ""{_streamUrl}"" -ac 2 -f s16le -ar 48000 pipe:1",
				RedirectStandardOutput = true,
				UseShellExecute = false,
			});

			using (_stream = ffmpeg.StandardOutput.BaseStream)
			{
				while (_stream.CanRead)
				{
					if (_buffer.Count < bufferSize)
					{
						byte[] byteStream = new byte[1024];
						await _stream.ReadAsync(byteStream);
						_buffer.Add(byteStream);
						if (ffmpeg.HasExited) _stream.Close();
					}
				}
			}
		}
	}
}
